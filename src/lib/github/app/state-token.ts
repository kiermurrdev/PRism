/**
 * Signed state tokens for the GitHub App installation flow.
 *
 * Creates short-lived, cryptographically signed tokens that encode the
 * expected installation callback state so we can verify that the user
 * who clicked "Install" is the same user who completes the flow.
 *
 * SERVER-ONLY. Do not import into client-side code.
 */

import { createHmac, randomBytes } from "node:crypto";

/**
 * How long a signed state token is valid (5 minutes).
 */
const STATE_TTL_SECONDS = 5 * 60;

/**
 * Data encoded in a signed state token.
 */
export interface StateTokenPayload {
  /** The Auth.js user ID of the person initiating installation. */
  userId: string;
  /** Unix timestamp when the token was created. */
  iat: number;
}

/**
 * A signed state token result.
 */
export type StateTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: StateTokenError };

/**
 * Error codes for state token operations.
 */
export type StateTokenErrorCode =
  | "MISSING_SECRET"
  | "MISSING_USER_ID"
  | "INVALID_FORMAT"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "UNKNOWN_ERROR";

/**
 * A typed state token error.
 */
export interface StateTokenError {
  code: StateTokenErrorCode;
  message: string;
}

/**
 * Get the HMAC secret from environment.
 */
function getHmacSecret(): string | null {
  return process.env.AUTH_SECRET ?? null;
}

/**
 * Create a signed state token for the installation flow.
 *
 * The token is a Base64-encoded JSON payload with an HMAC-SHA256 signature
 * appended. Format: base64(payload).signature
 *
 * @param userId - The authenticated user's ID.
 * @returns A signed token or an error.
 */
export function createStateToken(userId: string): StateTokenResult {
  const secret = getHmacSecret();
  if (!secret) {
    return {
      ok: false,
      error: {
        code: "MISSING_SECRET",
        message: "AUTH_SECRET is not configured.",
      },
    };
  }

  if (!userId) {
    return {
      ok: false,
      error: {
        code: "MISSING_USER_ID",
        message: "User ID is required.",
      },
    };
  }

  try {
    const payload: StateTokenPayload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(payloadBase64)
      .digest("hex");

    return { ok: true, token: `${payloadBase64}.${signature}` };
  } catch {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Failed to create state token.",
      },
    };
  }
}

/**
 * Verify and decode a signed state token.
 *
 * Validates the HMAC signature and checks expiration.
 *
 * @param token - The signed state token to verify.
 * @returns The decoded payload or an error.
 */
export function verifyStateToken(token: string): StateTokenPayload | StateTokenError {
  const secret = getHmacSecret();
  if (!secret) {
    return {
      code: "MISSING_SECRET",
      message: "AUTH_SECRET is not configured.",
    };
  }

  if (!token || typeof token !== "string") {
    return {
      code: "INVALID_FORMAT",
      message: "State token is missing or invalid.",
    };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return {
      code: "INVALID_FORMAT",
      message: "State token has invalid format.",
    };
  }

  const [payloadBase64, signature] = parts;

  // Verify signature
  const expectedSignature = createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("hex");

  if (signature !== expectedSignature) {
    return {
      code: "INVALID_SIGNATURE",
      message: "State token signature is invalid.",
    };
  }

  // Decode payload
  let payload: StateTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  } catch {
    return {
      code: "INVALID_FORMAT",
      message: "State token payload is malformed.",
    };
  }

  // Validate required fields
  if (!payload.userId || typeof payload.userId !== "string") {
    return {
      code: "INVALID_FORMAT",
      message: "State token is missing user ID.",
    };
  }

  if (!payload.iat || typeof payload.iat !== "number") {
    return {
      code: "INVALID_FORMAT",
      message: "State token is missing timestamp.",
    };
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now - payload.iat > STATE_TTL_SECONDS) {
    return {
      code: "EXPIRED",
      message: "State token has expired.",
    };
  }

  return payload;
}
