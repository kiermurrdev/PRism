/**
 * GitHub App webhook signature verification.
 *
 * SERVER-ONLY. Verifies X-Hub-Signature-256 using HMAC-SHA256
 * with a timing-safe comparison. No network access.
 */

import crypto from "crypto";

/**
 * Error codes for webhook verification failures.
 */
export type WebhookErrorKind =
  | "MISSING_SIGNATURE"
  | "INVALID_SIGNATURE"
  | "MALFORMED_JSON"
  | "INVALID_PAYLOAD"
  | "MISSING_CONFIGURATION";

/**
 * A typed webhook error.
 */
export interface WebhookError {
  code: WebhookErrorKind;
  message: string;
}

/**
 * Compute the expected HMAC-SHA256 signature for a raw body.
 *
 * @param secret - The webhook secret used to sign payloads.
 * @param payload - The raw request body (as Buffer or string).
 * @returns The hex-encoded signature prefixed with "sha256=".
 */
export function computeSignature(secret: string, payload: Buffer | string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Timing-safe comparison of two signature strings.
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 *
 * @param expected - The computed signature.
 * @param actual - The signature from the request header.
 * @returns true if the signatures match.
 */
export function signaturesMatch(expected: string, actual: string): boolean {
  // Empty signatures are never valid.
  if (expected.length === 0 || actual.length === 0) {
    return false;
  }
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(actual);
    return crypto.timingSafeEqual(a, b);
  } catch {
    // If lengths differ significantly or encoding fails, crypto.timingSafeEqual throws.
    return false;
  }
}

/**
 * Verify a GitHub webhook signature.
 *
 * @param secret - The configured webhook secret.
 * @param signatureHeader - The value of X-Hub-Signature-256.
 * @param rawBody - The raw request body.
 * @returns null on success, or a WebhookError on failure.
 */
export function verifySignature(
  secret: string,
  signatureHeader: string | null,
  rawBody: Buffer | string
): WebhookError | null {
  if (!signatureHeader || signatureHeader.trim() === "") {
    return {
      code: "MISSING_SIGNATURE",
      message: "X-Hub-Signature-256 header is missing.",
    };
  }

  const expected = computeSignature(secret, rawBody);
  if (!signaturesMatch(expected, signatureHeader)) {
    return {
      code: "INVALID_SIGNATURE",
      message: "Webhook signature verification failed.",
    };
  }

  return null;
}
