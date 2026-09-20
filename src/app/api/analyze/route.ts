/**
 * POST /api/analyze
 *
 * Orchestrates the full PR analysis pipeline with concurrency guard and caching:
 * 1. Validate request body and construct PR URL
 * 2. Apply one-at-a-time concurrency guard
 * 3. Ingest PR via GitHub module
 * 4. Generate bounded context
 * 5. Analyze via Nemotron
 * 6. Validate final result against shared schema
 * 7. Return success or safe error envelope
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestPR } from "@/lib/github";
import type { GitHubError } from "@/lib/github/types";
import { generateContext } from "@/lib/analysis/context/generator";
import { analyzeWithNemotron } from "@/lib/nemotron";
import type { NemotronError, NemotronContext } from "@/lib/nemotron/types";
import { AnalysisRequestSchema, AnalysisResultSchema } from "@/lib/analysis/schema";
import type { AnalysisResult } from "@/types/analysis";
import { withAnalysisGuard, buildCacheKey } from "@/lib/server/analysis-guard";

/**
 * Map a GitHubError to a safe HTTP response.
 */
function githubErrorResponse(error: GitHubError): NextResponse {
  const { code, message } = error;

  switch (code) {
    case "INVALID_URL":
      return NextResponse.json({ code, message }, { status: 400 });
    case "PR_NOT_FOUND":
      return NextResponse.json({ code, message }, { status: 404 });
    case "RATE_LIMITED":
      return NextResponse.json({ code, message }, { status: 429 });
    case "ACCESS_DENIED":
      return NextResponse.json({ code, message }, { status: 403 });
    case "TOO_LARGE":
      return NextResponse.json({ code, message }, { status: 413 });
    case "NETWORK_ERROR":
    case "GITHUB_ERROR":
    default:
      return NextResponse.json(
        { code: "GITHUB_ERROR", message: "A GitHub API error occurred." },
        { status: 502 }
      );
  }
}

/**
 * Map a NemotronError to a safe HTTP response.
 */
function nemotronErrorResponse(error: NemotronError): NextResponse {
  const { code } = error;

  switch (code) {
    case "MISSING_CONFIG":
      return NextResponse.json(
        { code, message: "Analysis service is misconfigured." },
        { status: 503 }
      );
    case "TIMEOUT":
      return NextResponse.json(
        { code, message: "Analysis request timed out." },
        { status: 504 }
      );
    case "AUTH_FAILURE":
      return NextResponse.json(
        { code, message: "Analysis service authentication failed." },
        { status: 502 }
      );
    case "RATE_LIMITED":
      return NextResponse.json(
        { code, message: "Analysis service rate limit exceeded." },
        { status: 429 }
      );
    case "INVALID_JSON":
    case "SCHEMA_INVALID":
      return NextResponse.json(
        { code, message: "Analysis service returned invalid data." },
        { status: 502 }
      );
    case "NETWORK_ERROR":
    case "UPSTREAM_ERROR":
    default:
      return NextResponse.json(
        { code: "UPSTREAM_ERROR", message: "Analysis service error." },
        { status: 502 }
      );
  }
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
 */
async function runAnalysis(repo: string, prNumber: number, prUrl: string): Promise<AnalysisResult> {
  // 1. Ingest PR via GitHub module
  const ingestResult = await ingestPR(prUrl);
  if (!ingestResult.ok) {
    throw ingestResult.error;
  }

  const snapshot = ingestResult.snapshot;

  // 2. Generate bounded context
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
  const nemotronResult = await analyzeWithNemotron(nemotronContext);
  if (!nemotronResult.ok) {
    throw nemotronResult.error;
  }

  const report = nemotronResult.report;

  // 5. Construct AnalysisResult and validate against schema
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
  try {
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

    // 2. First, do a quick ingest to get headSha for cache keying
    // (This is lightweight compared to the full analysis)
    const ingestResult = await ingestPR(prUrl);
    if (!ingestResult.ok) {
      return githubErrorResponse(ingestResult.error);
    }

    const snapshot = ingestResult.snapshot;
    const key = buildCacheKey(repo, prNumber, snapshot.headSha);

    // 3. Run analysis under the concurrency guard
    try {
      const result = await withAnalysisGuard(key, async () => {
        return runAnalysis(repo, prNumber, prUrl);
      });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof Error) {
        // Guard timeout
        if (err.message.includes("in progress")) {
          return NextResponse.json(
            {
              code: "CONCURRENT_REQUEST",
              message: "Another analysis is in progress. Please try again shortly.",
            },
            { status: 409 }
          );
        }
        // Guard state error
        if (err.message.includes("guard state error")) {
          return NextResponse.json(
            {
              code: "INTERNAL_ERROR",
              message: "An unexpected error occurred.",
            },
            { status: 500 }
          );
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
          return githubErrorResponse(githubErr);
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
          return nemotronErrorResponse(nemotronErr);
        }
      }

      // Catch-all: never expose stack traces or internals
      return NextResponse.json(
        {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
        { status: 500 }
      );
    }
  } catch {
    // Catch-all: never expose stack traces or internals
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
