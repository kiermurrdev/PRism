/**
 * Entry point for GitHub PR ingestion.
 *
 * Takes a GitHub PR URL and returns a bounded, typed snapshot or a safe error.
 */

import type { GitHubError, PRSnapshot } from "./types";
import { parseGitHubPRUrl, createInvalidUrlError } from "./url";
import { fetchPRSnapshot } from "./client";

/**
 * Ingest a public GitHub pull request.
 *
 * Returns a bounded snapshot on success, or a typed error on failure.
 *
 * @param url - The GitHub PR URL (must be canonical: https://github.com/owner/repo/pull/N)
 */
export async function ingestPR(url: string): Promise<
  | { ok: true; snapshot: PRSnapshot }
  | { ok: false; error: GitHubError }
> {
  // Validate URL before any network request
  const parsed = parseGitHubPRUrl(url);
  if (!parsed) {
    return { ok: false, error: createInvalidUrlError() };
  }

  // Fetch the snapshot
  const result = await fetchPRSnapshot(parsed.owner, parsed.repo, parsed.prNumber);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, snapshot: result.snapshot };
}
