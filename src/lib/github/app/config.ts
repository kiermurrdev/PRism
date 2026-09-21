/**
 * Configuration loader for the GitHub App integration.
 *
 * Reads and validates environment variables, returning a typed config or
 * a sanitized configuration error. No network access or side effects.
 */

import type {
  GitHubAppConfig,
  GitHubAppConfigError,
} from "./contracts";

/**
 * Load and validate the GitHub App configuration from environment variables.
 *
 * Returns the config on success or a typed error on failure.
 */
export function loadGitHubAppConfig():
  | { ok: true; config: GitHubAppConfig }
  | { ok: false; error: GitHubAppConfigError } {
  // Validate GITHUB_APP_ID
  const appIdRaw = process.env.GITHUB_APP_ID;
  if (!appIdRaw) {
    return {
      ok: false,
      error: {
        code: "MISSING_GITHUB_APP_ID",
        message: "GITHUB_APP_ID environment variable is not set.",
      },
    };
  }
  const appId = parseInt(appIdRaw, 10);
  if (isNaN(appId) || appId <= 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_GITHUB_APP_ID",
        message: "GITHUB_APP_ID must be a positive integer.",
      },
    };
  }

  // Validate GITHUB_APP_PRIVATE_KEY
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!privateKey) {
    return {
      ok: false,
      error: {
        code: "MISSING_GITHUB_APP_PRIVATE_KEY",
        message: "GITHUB_APP_PRIVATE_KEY environment variable is not set.",
      },
    };
  }

  // Validate GITHUB_WEBHOOK_SECRET
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return {
      ok: false,
      error: {
        code: "MISSING_GITHUB_WEBHOOK_SECRET",
        message: "GITHUB_WEBHOOK_SECRET environment variable is not set.",
      },
    };
  }

  // Validate GITHUB_APP_SLUG
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return {
      ok: false,
      error: {
        code: "MISSING_GITHUB_APP_SLUG",
        message: "GITHUB_APP_SLUG environment variable is not set.",
      },
    };
  }

  // Validate NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return {
      ok: false,
      error: {
        code: "MISSING_APP_URL",
        message: "NEXT_PUBLIC_APP_URL environment variable is not set.",
      },
    };
  }
  try {
    new URL(appUrl);
  } catch {
    return {
      ok: false,
      error: {
        code: "INVALID_APP_URL",
        message: "NEXT_PUBLIC_APP_URL must be a valid absolute URL.",
      },
    };
  }

  return {
    ok: true,
    config: {
      appId,
      privateKey,
      webhookSecret,
      appSlug,
      appUrl,
    },
  };
}
