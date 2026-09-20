/**
 * POST /api/github-webhooks
 *
 * GitHub App webhook receiver.
 *
 * Verifies HMAC-SHA256 signature, validates and normalizes pull_request events,
 * and publishes an idempotent PRism analysis comment on the PR. Fast, no
 * Nemotron analysis in the critical path.
 *
 * SERVER-ONLY.
 */

import { NextRequest } from "next/server";
import { loadGitHubAppConfig } from "@/lib/github/app/config";
import { handleWebhook } from "@/lib/github/app/webhook-handler";
import { publishPrComment } from "@/lib/github/app/comment-publisher";
import type { NormalizedWebhookEvent } from "@/lib/github/app/contracts";

/**
 * Handler called for each validated pull_request event.
 *
 * Publishes the PRism analysis comment asynchronously. Errors are caught so
 * the webhook itself never fails — GitHub will retry on its schedule.
 */
async function webhookHandler(event: NormalizedWebhookEvent): Promise<void> {
  const configResult = loadGitHubAppConfig();
  if (!configResult.ok) {
    // Config error logged internally; webhook still returns 200.
    return;
  }

  const { appId, privateKey, appSlug, appUrl } = configResult.config;

  try {
    const result = await publishPrComment({
      event,
      config: { appId, privateKey, appSlug, appUrl },
    });

    // Silent success/error — webhook should not fail on downstream issues.
    // In production, this would be logged to a structured logger.
    void result;
  } catch {
    // Handled silently — GitHub will retry.
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
