/**
 * Trigger.dev worker: full analysis pipeline.
 *
 * Implements the state machine:
 *   queued → ingesting → analyzing → persisting → done | failed
 *
 * SERVER-ONLY. This file is consumed by the Trigger.dev runtime.
 */

import { task } from "@trigger.dev/sdk/v3";
import type { AnalysisJobPayload } from "./queue";
import { db } from "@/lib/db/client";
import { analysisJobs, reports, repositories, installations, tenantAccounts, providerCredentials, prComments } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { fetchPRForInstallation, fetchChangedFilesForInstallation } from "@/lib/github/app/auth";
import { NemotronAdapter } from "@/lib/ai-adapters/nemotron";
import { publishPrComment } from "@/lib/github/app/comment-publisher";
import { decrypt } from "@/lib/vault/encryption";

const MAX_RETRIES = 3;
const MAX_CHANGED_FILES = 200;
const MAX_PATCH_BYTES = 100_000;
const MAX_TOTAL_TEXT_BYTES = 500_000;

function truncateBytes(str: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(str);
  if (encoded.length <= maxBytes) return str;
  return new TextDecoder().decode(encoded.slice(0, maxBytes));
}

async function resolveApiKey(credentialId: string | null): Promise<string | null> {
  if (!credentialId) return null;

  const [record] = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.id, credentialId))
    .limit(1);

  if (!record) return null;

  return decrypt(record.encryptedApiKey, record.keyVersion);
}

async function resolveUserId(installationId: string): Promise<string | null> {
  const [inst] = await db
    .select()
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1);

  if (!inst) return null;

  const [account] = await db
    .select()
    .from(tenantAccounts)
    .where(eq(tenantAccounts.id, inst.accountId))
    .limit(1);

  return account?.id ?? null;
}

export const analysisPipelineTask = task({
  id: "analysis-pipeline",
  retry: {
    maxAttempts: MAX_RETRIES,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
    factor: 2,
  },
  run: async (payload: AnalysisJobPayload, ctx) => {
    const {
      repositoryId,
      prNumber,
      headSha,
      action,
      installationId,
      credentialId,
      promptVersion,
      autoComment,
    } = payload;

    // 1. Look up the repository
    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);

    if (!repo) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    const repositoryFullName = repo.fullName;
    const [repoOwner, repoName] = repositoryFullName.split("/");
    const userId = await resolveUserId(repo.installationId);
    if (!userId) {
      throw new Error(`No user found for installation: ${repo.installationId}`);
    }

    // 2. Idempotency: check for any existing job with the same key.
    // The unique index covers (repositoryId, prNumber, headSha, credentialId, promptVersion).
    const existingJobs = await db
      .select()
      .from(analysisJobs)
      .where(
        and(
          eq(analysisJobs.repositoryId, repositoryId),
          eq(analysisJobs.prNumber, prNumber),
          eq(analysisJobs.headSha, headSha),
          sql`${analysisJobs.credentialId} IS ${credentialId}`,
          eq(analysisJobs.promptVersion, promptVersion),
        ),
      )
      .limit(1);

    if (existingJobs.length > 0) {
      const existingJob = existingJobs[0];
      const prUrl = `https://github.com/${repositoryFullName}/pull/${prNumber}`;

      // Already completed: return the existing report without re-running.
      if (existingJob.status === "completed") {
        const existingReports = await db
          .select()
          .from(reports)
          .where(eq(reports.jobId, existingJob.id))
          .limit(1);

        if (existingReports.length > 0) {
          return {
            jobId: existingJob.id,
            reportId: existingReports[0].id,
            prUrl,
            deduplicated: true,
          };
        }
      }

      // Job exists but not completed (queued/running/failed).
      // If failed, re-queue it; otherwise, another instance is processing it.
      if (existingJob.status === "failed") {
        await db
          .update(analysisJobs)
          .set({ status: "queued", errorMessage: null, updatedAt: new Date() })
          .where(eq(analysisJobs.id, existingJob.id));
      }

      return {
        jobId: existingJob.id,
        prUrl,
        deduplicated: true,
        reason: existingJob.status === "failed" ? "re-queued failed job" : "job already in progress",
      };
    }

    // 3. Create the job record (unique index guarantees no duplicates).
    const [job] = await db
      .insert(analysisJobs)
      .values({
        repositoryId,
        prNumber,
        headSha,
        credentialId: credentialId ?? undefined,
        promptVersion,
        status: "queued",
        attemptCount: 0,
      })
      .returning();

    const jobId = job.id;

    try {
      // 3. INGEST: fetch PR data from GitHub
      const prResult = await fetchPRForInstallation(
        installationId,
        repoOwner,
        repoName,
        prNumber
      );
      if (!prResult.ok) {
        throw new Error(`Failed to fetch PR: GitHub API returned ${prResult.status}`);
      }

      const filesResult = await fetchChangedFilesForInstallation(
        installationId,
        repoOwner,
        repoName,
        prNumber,
        MAX_CHANGED_FILES
      );
      if (!filesResult.ok) {
        throw new Error(`Failed to fetch changed files: GitHub API returned ${filesResult.status}`);
      }

      // Apply bounds to patches
      let totalTextBytes = 0;
      const boundedFiles = filesResult.files.map((file) => {
        let patch = file.patch;
        if (patch) {
          const patchBytes = new TextEncoder().encode(patch).length;
          if (patchBytes > MAX_PATCH_BYTES || totalTextBytes + patchBytes > MAX_TOTAL_TEXT_BYTES) {
            const remaining = Math.min(
              MAX_PATCH_BYTES,
              MAX_TOTAL_TEXT_BYTES - totalTextBytes
            );
            if (remaining > 0) {
              patch = truncateBytes(patch, remaining);
              totalTextBytes += new TextEncoder().encode(patch).length;
            } else {
              patch = undefined;
            }
          } else {
            totalTextBytes += patchBytes;
          }
        }
        return { ...file, patch };
      });

      // 4. ANALYZE: call the Nemotron adapter
      let apiKey: string | undefined = process.env.NVIDIA_API_KEY;
      if (credentialId) {
        const decrypted = await resolveApiKey(credentialId);
        if (decrypted) {
          apiKey = decrypted;
        }
      }

      const adapter = new NemotronAdapter({
        apiKey: apiKey ?? undefined,
        baseUrl: process.env.NEMOTRON_BASE_URL,
        modelId: process.env.NEMOTRON_MODEL,
      });

      const baseBranch = prResult.data?.baseBranch ?? "main";
      const headBranch = prResult.data?.headBranch ?? "unknown";
      const prUrl = `https://github.com/${repositoryFullName}/pull/${prNumber}`;
      const prTitle = prResult.data?.title ?? "";

      const analysisContext = {
        repo: repositoryFullName,
        prNumber,
        title: prTitle,
        prUrl,
        headSha,
        baseBranch,
        headBranch,
        changedFiles: boundedFiles.map((f) => ({
          path: f.filename,
          status: (f.status === "added" ? "added" : f.status === "deleted" ? "deleted" : "modified") as "added" | "modified" | "deleted",
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        })),
      };

      const analysisResult = await adapter.analyze(analysisContext);
      if (!analysisResult.ok) {
        throw new Error(`Analysis failed: ${analysisResult.error.message}`);
      }

      // 5. PERSIST: save the report
      const reportData = analysisResult.report;

      const [report] = await db
        .insert(reports)
        .values({
          jobId,
          repositoryId,
          userId,
          headSha,
          provider: "nvidia",
          model: process.env.NEMOTRON_MODEL ?? "nvidia/nemotron-nano-12b-8k-instruct",
          promptVersion,
          title: reportData.title ?? `Analysis: ${prTitle}`,
          prUrl,
          summary: reportData.summary ?? "",
          nodes: reportData.nodes ?? [],
          edges: reportData.edges ?? [],
          findings: reportData.findings ?? [],
          qaItems: reportData.qaItems ?? [],
          affectedFiles: reportData.affectedFiles ?? [],
          schemaVersion: "v1",
        })
        .returning();

      // 6. COMMENT: post to PR if configured
      if (autoComment) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;

        const publishResult = await publishPrComment({
          repositoryFullName,
          prNumber,
          prTitle,
          headSha,
          installationId,
          reportId: report.id,
          config: {
            appId: parseInt(process.env.GITHUB_APP_ID ?? "0", 10),
            privateKey: process.env.GITHUB_APP_PRIVATE_KEY ?? "",
            appSlug: process.env.GITHUB_APP_SLUG ?? "prism",
            appUrl: appUrl ?? "",
          },
        });

        if (!publishResult.ok) {
          console.warn("Failed to publish PR comment:", publishResult.error);
        } else {
          // Track the comment in prComments table using upsert to avoid race conditions.
          const githubCommentId =
            publishResult.action === "created" || publishResult.action === "updated"
              ? publishResult.commentId
              : null;

          await db
            .insert(prComments)
            .values({
              repositoryId,
              prNumber,
              reportId: report.id,
              headSha,
              githubCommentId,
            })
            .onConflictDoUpdate({
              target: [prComments.repositoryId, prComments.prNumber],
              set: {
                reportId: report.id,
                headSha,
                githubCommentId: githubCommentId ?? undefined,
                updatedAt: new Date(),
              },
            });
        }
      }

      // Mark job as completed
      await db
        .update(analysisJobs)
        .set({
          status: "completed",
          updatedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(analysisJobs.id, jobId));

      return {
        jobId,
        reportId: report.id,
        prUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentAttempt = job.attemptCount + 1;

      // Update job with error
      await db
        .update(analysisJobs)
        .set({
          status: currentAttempt >= MAX_RETRIES ? "failed" : "queued",
          errorMessage,
          attemptCount: currentAttempt,
          updatedAt: new Date(),
        })
        .where(eq(analysisJobs.id, jobId));

      // Re-throw to trigger retry if attempts remain
      if (currentAttempt < MAX_RETRIES) {
        throw error;
      }

      return {
        jobId,
        error: errorMessage,
      };
    }
  },
});
