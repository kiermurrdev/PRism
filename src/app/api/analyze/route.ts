/**
 * POST /api/analyze
 *
 * Orchestrates the full PR analysis pipeline with concurrency guard and caching:
 * 1. Validate request body and construct PR URL
 * 2. Apply one-at-a-time concurrency guard
 * 3. Stream real-time progress snapshots via NDJSON
 * 4. Ingest PR via GitHub module
 * 5. Generate bounded context
 * 6. Analyze via Nemotron
 * 7. Validate final result against shared schema
 * 8. Return success or safe error envelope
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestPR } from "@/lib/github";
import type { GitHubError } from "@/lib/github/types";
import { generateContext } from "@/lib/analysis/context/generator";
import { analyzeWithNemotron } from "@/lib/nemotron";
import type { NemotronError, NemotronContext } from "@/lib/nemotron/types";
import { AnalysisRequestSchema, AnalysisResultSchema } from "@/lib/analysis/schema";
import type { AnalysisResult, AnalysisSnapshot } from "@/types/analysis";
import { withAnalysisGuard, buildCacheKey } from "@/lib/server/analysis-guard";

/**
 * NDJSON progress event types streamed to the client.
 */
type ProgressEvent =
  | { type: "stage"; snapshot: AnalysisSnapshot }
  | { type: "complete"; data: AnalysisResult }
  | { type: "error"; code: string; message: string };

/**
 * Write an NDJSON line to a writable stream.
 */
function writeEvent(stream: WritableStreamDefaultWriter, event: ProgressEvent): void {
  const line = JSON.stringify(event) + "\n";
  stream.write(new TextEncoder().encode(line));
}

/**
 * Construct a canonical GitHub PR URL from repo and prNumber.
 */
function buildPRUrl(repo: string, prNumber: number): string {
  return `https://github.com/${repo}/pull/${prNumber}`;
}

/**
 * Map ChangedFile from GitHub snapshot to Nemotron's ChangedFileContext.
 */
function mapChangedFiles(
  files: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed" | "copied";
    additions: number;
    deletions: number;
    patch?: string;
  }>
) {
  return files.map((f) => {
    const rawStatus = f.status;
    let status: "added" | "modified" | "deleted";
    if (rawStatus === "renamed" || rawStatus === "copied") {
      status = "modified";
    } else {
      status = rawStatus;
    }
    return {
      path: f.path,
      status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    };
  });
}

/**
 * Core analysis pipeline (called inside the concurrency guard).
 * Emits stage events via the provided writer as work progresses.
 */
async function runAnalysis(
  repo: string,
  prNumber: number,
  prUrl: string,
  writer: WritableStreamDefaultWriter
): Promise<AnalysisResult> {
  // 1. Ingest PR via GitHub module
  writeEvent(writer, {
    type: "stage",
    snapshot: {
      status: "fetching",
      message: "Reading pull request",
    },
  });

  const ingestResult = await ingestPR(prUrl);
  if (!ingestResult.ok) {
    throw ingestResult.error;
  }

  const snapshot = ingestResult.snapshot;

  // 2. Generate bounded context
  writeEvent(writer, {
    type: "stage",
    snapshot: {
      status: "analyzing",
      message: "Mapping repository components",
    },
  });

  const { context: repoContext } = generateContext(snapshot);

  // 3. Build Nemotron context from snapshot
  const nemotronContext: NemotronContext = {
    repo: snapshot.repo,
    prNumber: snapshot.prNumber,
    title: snapshot.title,
    prUrl,
    headSha: snapshot.headSha,
    baseBranch: snapshot.baseBranch,
    headBranch: snapshot.headBranch,
    changedFiles: mapChangedFiles(snapshot.changedFiles),
    repoContext,
  };

  // 4. Analyze via Nemotron
  writeEvent(writer, {
    type: "stage",
    snapshot: {
      status: "analyzing",
      message: "Tracing downstream effects",
    },
  });

  const nemotronResult = await analyzeWithNemotron(nemotronContext);
  if (!nemotronResult.ok) {
    throw nemotronResult.error;
  }

  // 5. Signal final stage
  writeEvent(writer, {
    type: "stage",
    snapshot: {
      status: "generating",
      message: "Generating QA checklist",
    },
  });

  const report = nemotronResult.report;

  // 6. Construct AnalysisResult and validate against schema
  const analysisResult: AnalysisResult = {
    ...report,
    metadata: {
      source: "live",
      analyzedAt: new Date().toISOString(),
      headSha: snapshot.headSha,
    },
  };

  const validateResult = AnalysisResultSchema.safeParse(analysisResult);
  if (!validateResult.success) {
    throw new Error("Analysis result validation failed.");
  }

  return validateResult.data;
}

export async function POST(request: NextRequest) {
  // 1. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "Request body must be valid JSON.",
      },
      { status: 400 }
    );
  }

  const parseResult = AnalysisRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "Invalid request payload.",
      },
      { status: 400 }
    );
  }

  const { repo, prNumber } = parseResult.data;
  const prUrl = buildPRUrl(repo, prNumber);

  // Create a TransformStream to pipe NDJSON events to the client
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Run the pipeline asynchronously
  (async () => {
    try {
      // First, do a quick ingest to get headSha for cache keying
      const ingestResult = await ingestPR(prUrl);
      if (!ingestResult.ok) {
        const err = ingestResult.error;
        writeEvent(writer, { type: "error", code: err.code, message: err.message });
        await writer.close();
        return;
      }

      const snapshot = ingestResult.snapshot;
      const key = buildCacheKey(repo, prNumber, snapshot.headSha);

      // Run analysis under the concurrency guard
      const result = await withAnalysisGuard(key, async () => {
        return runAnalysis(repo, prNumber, prUrl, writer);
      });

      // Emit final result
      writeEvent(writer, { type: "complete", data: result });
      await writer.close();
    } catch (err) {
      try {
        if (err instanceof Error) {
          // Guard timeout
          if (err.message.includes("in progress")) {
            writeEvent(writer, {
              type: "error",
              code: "CONCURRENT_REQUEST",
              message: "Another analysis is in progress. Please try again shortly.",
            });
            await writer.close();
            return;
          }
          // Guard state error
          if (err.message.includes("guard state error")) {
            writeEvent(writer, {
              type: "error",
              code: "INTERNAL_ERROR",
              message: "An unexpected error occurred.",
            });
            await writer.close();
            return;
          }
        }

        // Check if it's a GitHubError or NemotronError
        const typedErr = err as GitHubError | NemotronError;
        if ("code" in typedErr) {
          const githubErr = typedErr as GitHubError;
          if (
            githubErr.code === "INVALID_URL" ||
            githubErr.code === "PR_NOT_FOUND" ||
            githubErr.code === "RATE_LIMITED" ||
            githubErr.code === "ACCESS_DENIED" ||
            githubErr.code === "TOO_LARGE" ||
            githubErr.code === "NETWORK_ERROR" ||
            githubErr.code === "GITHUB_ERROR"
          ) {
            writeEvent(writer, {
              type: "error",
              code: githubErr.code,
              message: githubErr.message,
            });
            await writer.close();
            return;
          }

          const nemotronErr = typedErr as NemotronError;
          if (
            nemotronErr.code === "MISSING_CONFIG" ||
            nemotronErr.code === "TIMEOUT" ||
            nemotronErr.code === "AUTH_FAILURE" ||
            nemotronErr.code === "RATE_LIMITED" ||
            nemotronErr.code === "INVALID_JSON" ||
            nemotronErr.code === "SCHEMA_INVALID" ||
            nemotronErr.code === "NETWORK_ERROR" ||
            nemotronErr.code === "UPSTREAM_ERROR"
          ) {
            writeEvent(writer, {
              type: "error",
              code: nemotronErr.code,
              message: nemotronErr.message,
            });
            await writer.close();
            return;
          }
        }

        // Catch-all
        writeEvent(writer, {
          type: "error",
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        });
      } finally {
        await writer.close().catch(() => {});
      }
    }
  })().catch(async () => {
    // Outer catch for any unhandled promise rejection
    try {
      writeEvent(writer, {
        type: "error",
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      });
    } finally {
      await writer.close().catch(() => {});
    }
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
