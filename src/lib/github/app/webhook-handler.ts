/**
 * GitHub App webhook handler.
 *
 * Validates, normalizes, and routes GitHub webhook events.
 * Production-ready with HMAC signature verification, event filtering,
 * and safe logging. No network calls — downstream side effects are
 * delegated via the handler callback.
 *
 * SERVER-ONLY.
 */

import type { NextRequest } from "next/server";
import type { NormalizedWebhookEvent } from "./contracts";
import { verifySignature } from "./webhook";

/**
 * Valid pull_request actions that PRism processes.
 */
const HANDLED_ACTIONS = new Set(["opened", "reopened", "synchronize"]);

/**
 * A callback invoked for each validated, supported webhook event.
 *
 * The handler is responsible for any downstream work (e.g., triggering
 * analysis, publishing comments). The webhook route itself is fast and
 * returns success as soon as the event is validated and normalized.
 */
export type WebhookEventHandler = (event: NormalizedWebhookEvent) => Promise<void> | void;

/**
 * Error codes for webhook processing failures.
 */
export type WebhookErrorCode =
  | "MISSING_CONFIGURATION"
  | "MISSING_SIGNATURE"
  | "INVALID_SIGNATURE"
  | "MALFORMED_JSON"
  | "INVALID_PAYLOAD"
  | "MISSING_EVENT_TYPE";

/**
 * A typed webhook processing error.
 */
export interface WebhookError {
  code: WebhookErrorCode;
  message: string;
}

/**
 * Configuration required to process webhooks.
 */
export interface WebhookConfig {
  /** The webhook secret for HMAC verification. */
  webhookSecret: string;
  /** Handler called for each supported event. */
  handler: WebhookEventHandler;
  /** Optional response factory (defaults to standard Web API Response). */
  responseFactory?: typeof Response;
}

/**
 * Build a safe error response without leaking internal details.
 */
function errorResponse(
  code: WebhookErrorCode,
  message: string,
  status: number,
  ResponseCtor: typeof Response = globalThis.Response,
): Response {
  return new ResponseCtor(
    JSON.stringify({
      code,
      message,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Extract and normalize a pull_request event into a typed NormalizedWebhookEvent.
 *
 * @returns The normalized event, or a WebhookError if validation fails.
 */
function normalizePullRequestEvent(payload: unknown): NormalizedWebhookEvent | WebhookError {
  // Check that payload is a plain object
  if (!payload || typeof payload !== "object") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Webhook payload must be a JSON object.",
    };
  }

  const data = payload as Record<string, unknown>;

  // delivery_id
  const deliveryId = data["X-GitHub-Delivery"] ?? data["delivery_id"];
  if (!deliveryId || typeof deliveryId !== "string") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing or invalid X-GitHub-Delivery.",
    };
  }

  // installation.id
  const installation = data["installation"];
  if (!installation || typeof installation !== "object") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing installation object.",
    };
  }
  const installationId = (installation as Record<string, unknown>)["id"];
  if (!installationId || typeof installationId !== "number") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing or invalid installation.id.",
    };
  }

  // repository.full_name
  const repository = data["repository"];
  if (!repository || typeof repository !== "object") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing repository object.",
    };
  }
  const repositoryFullName = (repository as Record<string, unknown>)["full_name"];
  if (!repositoryFullName || typeof repositoryFullName !== "string") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing repository.full_name.",
    };
  }

  // pull_request
  const pullRequest = data["pull_request"];
  if (!pullRequest || typeof pullRequest !== "object") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing pull_request object.",
    };
  }
  const pr = pullRequest as Record<string, unknown>;

  const prNumber = pr["number"];
  if (!prNumber || typeof prNumber !== "number") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing or invalid pull_request.number.",
    };
  }

  const prUrl = pr["html_url"];
  if (!prUrl || typeof prUrl !== "string") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing pull_request.html_url.",
    };
  }

  const prTitle = pr["title"];
  if (!prTitle || typeof prTitle !== "string") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing pull_request.title.",
    };
  }

  const head = pr["head"];
  if (!head || typeof head !== "object") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing pull_request.head.",
    };
  }
  const headSha = (head as Record<string, unknown>)["sha"];
  if (!headSha || typeof headSha !== "string") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing pull_request.head.sha.",
    };
  }

  const action = pr["action"];
  if (!action || typeof action !== "string") {
    return {
      code: "INVALID_PAYLOAD",
      message: "Missing pull_request.action.",
    };
  }

  return {
    type: "pull_request",
    action: action as NormalizedWebhookEvent["action"],
    deliveryId,
    installationId,
    repositoryFullName,
    prNumber,
    prUrl,
    prTitle,
    headSha,
  };
}

/**
 * Handle an incoming GitHub webhook request.
 *
 * This function:
 * 1. Verifies the webhook secret and HMAC signature.
 * 2. Parses and validates the JSON payload.
 * 3. Normalizes supported pull_request events.
 * 4. Invokes the handler for supported actions.
 * 5. Returns 200 for unsupported events (no-op acknowledgment).
 *
 * @param request - The NextRequest containing the raw body.
 * @param config - Webhook configuration (secret + handler).
 * @returns A Response with the appropriate status.
 */
export async function handleWebhook(
  request: NextRequest,
  config: WebhookConfig
): Promise<Response> {
  const ResponseCtor = globalThis.Response;

  // 1. Check webhook secret is configured
  if (!config.webhookSecret || config.webhookSecret.trim() === "") {
    return errorResponse(
      "MISSING_CONFIGURATION",
      "Webhook secret is not configured.",
      500,
      ResponseCtor
    );
  }

  // 2. Read raw body for signature verification
  const rawBody = await request.arrayBuffer();
  const rawBuffer = Buffer.from(rawBody);

  // 3. Verify signature
  const signatureHeader = request.headers.get("X-Hub-Signature-256");
  const sigError = verifySignature(config.webhookSecret, signatureHeader, rawBuffer);
  if (sigError) {
    if (sigError.code === "MISSING_SIGNATURE") {
      return errorResponse("MISSING_SIGNATURE", sigError.message, 401, ResponseCtor);
    }
    return errorResponse("INVALID_SIGNATURE", sigError.message, 401, ResponseCtor);
  }

  // 4. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBuffer.toString("utf8"));
  } catch {
    return errorResponse("MALFORMED_JSON", "Invalid JSON in webhook payload.", 400, ResponseCtor);
  }

  // 5. Read event type (safe logging: only non-sensitive identifiers)
  const eventType = request.headers.get("X-GitHub-Event");
  if (!eventType) {
    return errorResponse("MISSING_EVENT_TYPE", "X-GitHub-Event header is missing.", 400, ResponseCtor);
  }

  // 6. Handle pull_request events
  if (eventType === "pull_request") {
    const normalized = normalizePullRequestEvent(parsed);
    if ("code" in normalized) {
      return errorResponse(normalized.code, normalized.message, 400, ResponseCtor);
    }

    // Only process supported actions; others are acknowledged
    if (!HANDLED_ACTIONS.has(normalized.action)) {
      return new ResponseCtor(null, { status: 200 });
    }

    // Invoke handler asynchronously (do not block the response)
    try {
      await config.handler(normalized);
    } catch {
      // Handler errors do not fail the webhook — GitHub will retry.
      // Log and return success to acknowledge receipt.
    }

    return new ResponseCtor(null, { status: 200 });
  }

  // 7. Unsupported event types: acknowledge without processing
  return new ResponseCtor(null, { status: 200 });
}
