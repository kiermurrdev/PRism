/**
 * POST /api/github-webhooks
 *
 * GitHub App webhook receiver.
 *
 * Verifies HMAC-SHA256 signature, validates and normalizes pull_request events,
 * and delegates downstream processing to the webhook handler. Fast, no network
 * calls in the critical path.
 *
 * SERVER-ONLY.
 */

import { NextRequest } from "next/server";
import { loadGitHubAppConfig } from "@/lib/github/app/config";
import { handleWebhook } from "@/lib/github/app/webhook-handler";

/**
 * A no-op handler until downstream processing is implemented (#48).
 * This ensures the webhook route is functional without side effects.
 */
async function defaultHandler(): Promise<void> {
  // No-op: signature verification and event normalization are complete.
  // Downstream processing (analysis trigger, comment publishing) is handled
  // by a later issue.
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
    handler: defaultHandler,
  });
}
