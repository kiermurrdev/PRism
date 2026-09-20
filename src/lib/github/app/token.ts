/**
 * GitHub API client for GitHub App authentication operations.
 *
 * This module is SERVER-ONLY. It must never be imported into client-side code.
 *
 * Exchanges a GitHub App JWT for an installation access token scoped to a
 * specific installation ID. All HTTP calls are injectable for testing.
 */

import type { GitHubAppAuthError } from "./contracts";

/**
 * GitHub API base URL.
 */
const GITHUB_API_BASE = "https://api.github.com";

/**
 * Fetch function interface for dependency injection.
 */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Default fetch implementation using the global fetch.
 */
const defaultFetch: FetchFn = async (url, init) => {
  return await globalThis.fetch(url, init);
};

/**
 * Configuration for requesting an installation access token.
 */
export interface InstallationTokenConfig {
  /** The JWT used to authenticate as the GitHub App. */
  jwt: string;
  /** The installation ID to scope the token to. */
  installationId: number;
}

/**
 * Result of an installation token request.
 */
export type InstallationTokenResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; error: GitHubAppAuthError };

/**
 * Classify a GitHub API error response into a typed error.
 */
function classifyAuthError(status: number, headers: Headers): GitHubAppAuthError {
  const rateLimitRemaining = headers.get("X-RateLimit-Remaining");

  if (status === 429 || rateLimitRemaining === "0") {
    return {
      code: "GITHUB_RATE_LIMITED",
      message: "GitHub API rate limit exceeded for authentication.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: "GITHUB_AUTH_REJECTED",
      message: "GitHub rejected the authentication request.",
    };
  }

  if (status >= 500) {
    return {
      code: "GITHUB_UPSTREAM_ERROR",
      message: "GitHub encountered an internal error.",
    };
  }

  return {
    code: "GITHUB_UPSTREAM_ERROR",
    message: "An unexpected error occurred while contacting GitHub.",
  };
}

/**
 * Request an installation access token from GitHub.
 */
export async function getInstallationAccessToken(
  config: InstallationTokenConfig,
  fetchFn: FetchFn = defaultFetch,
): Promise<InstallationTokenResult> {
  if (!config.installationId || config.installationId <= 0) {
    return {
      ok: false,
      error: {
        code: "MISSING_INSTALLATION_ID",
        message: "Installation ID is not set or invalid.",
      },
    };
  }

  if (!config.jwt) {
    return {
      ok: false,
      error: {
        code: "JWT_SIGNING_FAILED",
        message: "JWT is required for authentication.",
      },
    };
  }

  const url = `${GITHUB_API_BASE}/app/installations/${config.installationId}/access_tokens`;

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "PRism-GitHub-App",
      },
    });

    if (!response.ok) {
      console.error("[github-webhook] installation token request failed:", {
        status: response.status,
        body: await response.text(),
        installationId: config.installationId,
      });

      return {
        ok: false,
        error: classifyAuthError(response.status, response.headers),
      };
    }

    const data: { token?: string; expires_at?: string } = await response.json();

    if (!data.token) {
      return {
        ok: false,
        error: {
          code: "GITHUB_UPSTREAM_ERROR",
          message: "GitHub did not return a valid installation token.",
        },
      };
    }

    const expiresAt = data.expires_at
      ? new Date(data.expires_at).getTime()
      : 0;

    return { ok: true, token: data.token, expiresAt };
  } catch (error) {
    console.error(
      "[github-webhook] installation token request threw:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      ok: false,
      error: {
        code: "GITHUB_NETWORK_ERROR",
        message: "Failed to connect to GitHub for authentication.",
      },
    };
  }
}
