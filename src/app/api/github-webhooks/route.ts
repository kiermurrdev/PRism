/**
 * POST /api/github-webhooks
 *
 * GitHub App webhook receiver.
 *
 * Verifies HMAC-SHA256 signature, validates and normalizes pull_request events,
 * and enqueues an analysis job via Trigger.dev. Fast — no AI analysis in the
 * critical path.
 *
 * SERVER-ONLY.
 */

import { NextRequest } from "next/server";
import { loadGitHubAppConfig } from "@/lib/github/app/config";
import { handleWebhook } from "@/lib/github/app/webhook-handler";
import { jobQueue } from "@/lib/jobs/trigger-queue";
import type { NormalizedWebhookEvent } from "@/lib/github/app/contracts";
import { installationRepository, repositoryRepository, repositorySettingsRepository } from "@/lib/db/domain-repositories";

/**
 * Resolve repository and settings from a webhook event.
 * Returns null if the repository is not tracked in PRism.
 */
async function resolveRepositoryAndSettings(
  event: NormalizedWebhookEvent,
): Promise<{ repositoryId: string; installationId: string; credentialId: string | null; autoComment: boolean } | null> {
  // Find installation by GitHub installation ID
  const installations = await installationRepository.findByGithubInstallationId(event.installationId);
  if (installations.length === 0) {
    console.log("[github-webhook] no installation found:", event.installationId);
    return null;
  }
  const installationId = installations[0].id;

  // Find repository by full name
  const repositories = await repositoryRepository.findByFullName(event.repositoryFullName);
  if (repositories.length === 0) {
    console.log("[github-webhook] no repository found:", event.repositoryFullName);
    return null;
  }
  const repositoryId = repositories[0].id;

  // Load repository settings (defaults if missing)
  const settingsRows = await repositorySettingsRepository.findByRepository(repositoryId);
  const settings = settingsRows[0];
  const credentialId = settings?.credentialId ?? null;
  const autoComment = settings?.autoComment ?? true;

  return { repositoryId, installationId, credentialId, autoComment };
}

/**
 * Handler called for each validated pull_request event.
 *
 * Looks up the tracked repository and its settings, then enqueues an analysis
 * job via Trigger.dev. Returns quickly — no AI analysis or comment posting in
 * the webhook path. Errors are caught so the webhook itself never fails.
 */
async function webhookHandler(event: NormalizedWebhookEvent): Promise<void> {
  const configResult = loadGitHubAppConfig();
  if (!configResult.ok) {
    return;
  }

  const repoResult = await resolveRepositoryAndSettings(event);
  if (!repoResult) {
    // Repository not tracked in PRism — silently ignore.
    return;
  }

  const { repositoryId, installationId, credentialId, autoComment } = repoResult;

  try {
    const jobId = await jobQueue.enqueueAnalysis({
      repositoryId,
      prNumber: event.prNumber,
      headSha: event.headSha,
      action: event.action,
      installationId: event.installationId,
      credentialId,
      promptVersion: process.env.PROMPT_VERSION ?? "v1",
      autoComment,
    });

    console.log("[github-webhook] enqueued job:", jobId);
  } catch (error) {
    console.error("[github-webhook] enqueue failed:", error);
  }
}

export async function POST(request: NextRequest) {
  // Load webhook secret from configuration
  const configResult = loadGitHubAppConfig();
  if (!configResult.ok) {
    // Return 500 for configuration errors — GitHub will not retry.
    return new Response(
      JSON.stringify({
        code: "MISSING_CONFIGURATION",
        message: "Webhook configuration is incomplete.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const config = configResult.config;

  return await handleWebhook(request, {
    webhookSecret: config.webhookSecret,
    handler: webhookHandler,
  });
}
