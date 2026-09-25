/**
 * POST /api/analyze/start
 *
 * Creates an analysis job and returns its ID immediately.
 * The job runs asynchronously via the Trigger.dev pipeline.
 *
 * Requires authentication. Accepts a canonical PR URL or an encoded analysis link.
 * Optional credentialId for provider selection; falls back to repository default.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-required";
import { decodePrUrl } from "@/lib/analysis/analysis-link";
import { db } from "@/lib/db/client";
import { analysisJobs, repositories, installations, tenantAccounts, providerCredentials, repositorySettings, reports } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { analysisJobRepository, repositoryRepository, repositorySettingsRepository } from "@/lib/db/domain-repositories";
import { jobQueue } from "@/lib/jobs/trigger-queue";
import type { AnalysisJobPayload } from "@/lib/jobs/queue";
import { fetchPRForInstallation } from "@/lib/github/app/auth";

const EXAMPLE_PR_URL = "https://github.com/plausible/analytics/pull/6232";

/**
 * Parse a GitHub PR URL into { repoOwner, repoName, prNumber }.
 */
function parsePrUrl(url: string): { repoOwner: string; repoName: string; prNumber: number } | null {
  const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { repoOwner: match[1], repoName: match[2], prNumber: parseInt(match[3], 10) };
}

const StartAnalysisSchema = z.object({
  prUrl: z.string().url(),
  credentialId: z.string().uuid().optional(),
  promptVersion: z.string().optional().default("v1"),
  autoComment: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  // 1. Require auth
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult.user;

  // 2. Parse request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = StartAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid request payload." }, { status: 400 });
  }

  const { prUrl, credentialId, promptVersion, autoComment } = parsed.data;

  // 3. Decode if it's an encoded analysis link; otherwise use as-is
  const decodedPrUrl = decodePrUrl(prUrl) ?? prUrl;

  // 4. Parse the GitHub PR URL
  const prInfo = parsePrUrl(decodedPrUrl);
  if (!prInfo) {
    return NextResponse.json({ code: "INVALID_URL", message: "That doesn't look like a GitHub pull request URL." }, { status: 400 });
  }

  const repoFullName = `${prInfo.repoOwner}/${prInfo.repoName}`;

  // 5. Look up the repository in our DB
  const [repo] = await repositoryRepository.findByFullName(repoFullName);
  if (!repo) {
    return NextResponse.json({ code: "REPOSITORY_NOT_FOUND", message: `Repository "${repoFullName}" is not connected to this account.` }, { status: 404 });
  }

  // Fetch the installation to get the GitHub installation ID
  const [installation] = await db.select().from(installations).where(eq(installations.id, repo.installationId)).limit(1);
  if (!installation) {
    return NextResponse.json({ code: "REPOSITORY_NOT_FOUND", message: "Repository installation not found." }, { status: 404 });
  }
  const githubInstallationId = installation.githubInstallationId;

  // 6. Resolve credential: user-provided > repository default > null
  let resolvedCredentialId = credentialId;

  if (!resolvedCredentialId) {
    const [settings] = await repositorySettingsRepository.findByRepository(repo.id);
    if (settings?.credentialId) {
      resolvedCredentialId = settings.credentialId;
    }
  }

  // If user-provided credential, verify ownership
  if (credentialId) {
    const [cred] = await db.select().from(providerCredentials).where(eq(providerCredentials.id, credentialId)).limit(1);
    if (!cred || cred.userId !== user.id) {
      return NextResponse.json({ code: "INVALID_CREDENTIAL", message: "Credential not found or not owned by this user." }, { status: 403 });
    }
  }

  // 7. Fetch head SHA from GitHub
  const prResult = await fetchPRForInstallation(parseInt(repo.installationId, 10), prInfo.repoOwner, prInfo.repoName, prInfo.prNumber);
  if (!prResult.ok) {
    return NextResponse.json({ code: "PR_NOT_FOUND", message: "Could not fetch the pull request from GitHub." }, { status: 404 });
  }
  const headSha = prResult.data.headSha;
  if (!headSha) {
    return NextResponse.json({ code: "PR_NOT_FOUND", message: "Could not fetch the pull request from GitHub." }, { status: 404 });
  }

  // 8. Check for existing idempotent job
  const existingJob = await analysisJobRepository.findIdempotent(
    repo.id,
    prInfo.prNumber,
    headSha,
    resolvedCredentialId ?? null,
    promptVersion
  );

  if (existingJob.length > 0) {
    const job = existingJob[0];
    // If completed, return the report directly
    if (job.status === "completed") {
      const [report] = await db.select().from(reports).where(eq(reports.jobId, job.id)).limit(1);
      if (report) {
        return NextResponse.json({
          jobId: job.id,
          reportId: report.id,
          reportUrl: `/reports/${report.id}`,
          status: "completed",
        });
      }
    }
    // Return the existing job (in progress or queued)
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  }

  // 9. Create the job record
  const [job] = await analysisJobRepository.create({
    repositoryId: repo.id,
    prNumber: prInfo.prNumber,
    headSha,
    credentialId: resolvedCredentialId ?? undefined,
    promptVersion,
    status: "queued",
    attemptCount: 0,
  });

  // 10. Enqueue the analysis task
  const payload: AnalysisJobPayload = {
    repositoryId: repo.id,
    prNumber: prInfo.prNumber,
    headSha,
    action: "opened",
    installationId: parseInt(repo.installationId, 10),
    credentialId: resolvedCredentialId ?? null,
    promptVersion,
    autoComment,
  };

  try {
    await jobQueue.enqueueAnalysis(payload);
  } catch (err) {
    // Mark job as failed if enqueue fails
    await analysisJobRepository.update(job.id, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Failed to enqueue analysis job",
    });
    return NextResponse.json({ code: "ENQUEUE_FAILED", message: "Failed to start analysis job." }, { status: 500 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
  });
}
