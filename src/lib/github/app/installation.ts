/**
 * GitHub App installation URL construction.
 *
 * Builds the installation link from the app slug and optional configuration
 * parameters. Runs client-side using NEXT_PUBLIC_GITHUB_APP_SLUG.
 */

/**
 * Configuration for building the installation URL.
 */
export interface InstallationUrlOptions {
  /** The GitHub App slug. */
  appSlug: string;
  /** The URL GitHub should redirect to after installation. */
  redirectUrl: string;
  /** Optional: comma-separated repo IDs to pre-select (advanced use). */
  repositoryIds?: string;
}

/**
 * Build the GitHub App installation URL.
 *
 * Format: https://github.com/apps/{appSlug}/installations/new?state={redirectUrl}
 *
 * The redirectUrl is passed via the `state` parameter so GitHub returns the
 * user to our installation-success page.
 */
export function buildInstallationUrl(options: InstallationUrlOptions): string {
  const base = `https://github.com/apps/${encodeURIComponent(options.appSlug)}/installations/new`;
  const url = new URL(base);
  url.searchParams.set("state", options.redirectUrl);
  if (options.repositoryIds) {
    url.searchParams.set("permissions", options.repositoryIds);
  }
  return url.toString();
}

/**
 * Check if the GitHub App installation is configured (app slug is set).
 *
 * Uses NEXT_PUBLIC_GITHUB_APP_SLUG so it can run on the client without
 * exposing secrets.
 */
export function isGitHubAppConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
}

/**
 * Get the GitHub App slug from environment, or undefined if not configured.
 */
export function getGitHubAppSlug(): string | undefined {
  return process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
}

/**
 * Validate and parse installation callback query parameters.
 *
 * GitHub sends:
 *   - setup_action: "installed" | "uninstalled" | "updated"
 *   - installation_id: numeric ID
 *
 * Returns null if the parameters are missing or invalid.
 */
export function parseInstallationCallback(searchParams: URLSearchParams):
  | { ok: true; setupAction: string; installationId: number }
  | { ok: false; reason: string } {
  const setupAction = searchParams.get("setup_action");
  const installationIdStr = searchParams.get("installation_id");

  if (!setupAction) {
    return { ok: false, reason: "Missing setup_action parameter." };
  }

  if (!installationIdStr) {
    return { ok: false, reason: "Missing installation_id parameter." };
  }

  const installationId = parseInt(installationIdStr, 10);
  if (isNaN(installationId) || installationId <= 0) {
    return { ok: false, reason: "Invalid installation_id parameter." };
  }

  // Only accept known setup actions
  const validActions = ["installed", "uninstalled", "updated"];
  if (!validActions.includes(setupAction)) {
    return { ok: false, reason: "Unknown setup action." };
  }

  return { ok: true, setupAction, installationId };
}
