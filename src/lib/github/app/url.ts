/**
 * URL construction helpers for the GitHub App integration.
 *
 * Builds deterministic analysis URLs and webhook endpoint URLs.
 */

import type { AnalysisUrl } from "./contracts";

/**
 * Build a canonical analysis URL for a given PR.
 *
 * Format: <appUrl>/analyze?repo={repo}&pr={prNumber}&sha={sha}
 */
export function buildAnalysisUrl(
  appUrl: string,
  repo: string,
  prNumber: number,
  sha: string,
): AnalysisUrl {
  const base = new URL(appUrl);
  const path = base.pathname.replace(/\/$/, '') + '/analyze';
  const url = new URL(base.origin + path);
  url.searchParams.set("repo", repo);
  url.searchParams.set("pr", String(prNumber));
  url.searchParams.set("sha", sha);

  return {
    url: url.toString(),
    repo,
    prNumber,
    sha,
  };
}

/**
 * Build the webhook endpoint URL from the app base URL.
 *
 * Format: <appUrl>/api/github/webhook
 */
export function buildWebhookUrl(appUrl: string): string {
  return new URL("/api/github/webhook", appUrl).toString();
}

/**
 * Parse an analysis URL back into its components.
 *
 * Returns null if the URL does not match the expected format.
 */
export function parseAnalysisUrl(
  urlString: string,
): { repo: string; prNumber: number; sha: string } | null {
  try {
    const url = new URL(urlString);
    const repo = url.searchParams.get("repo");
    const prStr = url.searchParams.get("pr");
    const sha = url.searchParams.get("sha");

    if (!repo || !prStr || !sha) return null;

    const prNumber = parseInt(prStr, 10);
    if (isNaN(prNumber) || prNumber <= 0) return null;

    return { repo, prNumber, sha };
  } catch {
    return null;
  }
}
