/**
 * JWT generation for GitHub App authentication.
 *
 * This module is SERVER-ONLY. It must never be imported into client-side code.
 *
 * Generates short-lived JWTs used to authenticate as a GitHub App and request
 * installation access tokens. All operations use Web Crypto (ES256).
 */

import type { GitHubAppAuthError } from "./contracts";
import { normalizePrivateKey } from "./private-key";

/**
 * Default TTL for GitHub App JWTs (10 minutes).
 * GitHub accepts up to 10 minutes; we use the full window.
 */
const DEFAULT_JWT_TTL_SECONDS = 600;

/**
 * Maximum allowed clock skew (in seconds) when validating JWT timestamps.
 * We use a conservative 30-second window to avoid edge-case rejections.
 */
const MAX_CLOCK_SKEW_SECONDS = 30;

/**
 * Clock interface for time-dependent operations.
 *
 * Used for dependency injection in tests.
 */
export interface Clock {
  /** Returns the current Unix timestamp in seconds. */
  nowSeconds(): number;
}

/**
 * Default system clock using Date.now().
 */
const systemClock: Clock = {
  nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  },
};

/**
 * Crypto interface for JWT signing.
 *
 * Used for dependency injection in tests.
 */
export interface JwtCrypto {
  /**
   * Import a PEM-encoded private key for ES256 signing.
   */
  importKey(pem: string): Promise<CryptoKey>;

  /**
   * Sign a JWT payload using the imported key.
   */
  sign(key: CryptoKey, header: string, payload: string): Promise<string>;
}

/**
 * Default crypto implementation using Web Crypto API.
 */
const webCrypto: JwtCrypto = {
  async importKey(pem: string): Promise<CryptoKey> {
    // Strip PEM headers/footers and whitespace
    const base64 = pem
      .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
      .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
      .replace(/\s/g, "");

    const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    return await globalThis.crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  },

  async sign(key: CryptoKey, header: string, payload: string): Promise<string> {
    const data = new TextEncoder().encode(`${header}.${payload}`);
    const signature = await globalThis.crypto.subtle.sign(
      "ECDSA",
      key,
      data
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  },
};

/**
 * Configuration for JWT generation.
 */
export interface JwtConfig {
  /** The GitHub App's numeric ID. */
  appId: number;
  /** The normalized PEM-encoded private key. */
  privateKey: string;
  /** Time-to-live in seconds (default: 600). */
  ttlSeconds?: number;
}

/**
 * Result of a JWT generation attempt.
 */
export type JwtResult =
  | { ok: true; jwt: string }
  | { ok: false; error: GitHubAppAuthError };

/**
 * Create a GitHub App JWT.
 *
 * The JWT contains:
 * - iss: the app ID
 * - iat: issued-at timestamp (current time)
 * - exp: expiration timestamp (iat + ttl)
 *
 * @param config - JWT configuration including app ID and private key.
 * @param clock - Optional clock for testing (defaults to system time).
 * @param cryptoImpl - Optional crypto implementation for testing.
 * @returns A signed JWT or a typed error.
 */
export async function createJwt(
  config: JwtConfig,
  clock: Clock = systemClock,
  cryptoImpl: JwtCrypto = webCrypto
): Promise<JwtResult> {
  // Validate inputs
  if (!config.appId || config.appId <= 0) {
    return {
      ok: false,
      error: {
        code: "MISSING_GITHUB_APP_ID",
        message: "GITHUB_APP_ID is not set or invalid.",
      },
    };
  }

  if (!config.privateKey) {
    return {
      ok: false,
      error: {
        code: "MISSING_GITHUB_APP_PRIVATE_KEY",
        message: "GITHUB_APP_PRIVATE_KEY is not set.",
      },
    };
  }

  const normalizedKey = normalizePrivateKey(config.privateKey);
  const ttl = config.ttlSeconds ?? DEFAULT_JWT_TTL_SECONDS;

  try {
    const key = await cryptoImpl.importKey(normalizedKey);
    const now = clock.nowSeconds();

    // Build JWT header (ES256)
    const header = btoa(JSON.stringify({
      alg: "ES256",
      typ: "JWT",
    }));

    // Build JWT payload with clock skew tolerance
    const iat = now - MAX_CLOCK_SKEW_SECONDS;
    const exp = iat + ttl;

    const payload = btoa(JSON.stringify({
      iss: String(config.appId),
      iat,
      exp,
    }));

    const signature = await cryptoImpl.sign(key, header, payload);
    const jwt = `${header}.${payload}.${signature}`;

    return { ok: true, jwt };
  } catch {
    // Never expose key material or internal error details
    return {
      ok: false,
      error: {
        code: "JWT_SIGNING_FAILED",
        message: "Failed to sign JWT with the provided private key.",
      },
    };
  }
}

/**
 * Decode (without verification) a JWT to inspect its claims.
 *
 * Useful for debugging and testing. Does NOT validate the signature.
 *
 * @param jwt - The JWT string to decode.
 * @returns The decoded header and payload, or null if malformed.
 */
export function decodeJwtUnsafe(
  jwt: string
): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    return { header, payload };
  } catch {
    return null;
  }
}
