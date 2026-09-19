/**
 * URL parsing for GitHub pull requests.
 *
 * Accepts only canonical public PR URLs:
 *   https://github.com/{owner}/{repository}/pull/{number}
 */

import type { GitHubError } from "./types";

const GITHUB_PR_REGEX =
  /^https:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/pull\/(\d+)$/;

export interface ParsedGitHubPR {
  owner: string;
  repo: string;
  prNumber: number;
}

/**
 * Parse a GitHub PR URL into its components.
 *
 * Returns `null` if the URL is malformed or does not match the expected shape.
 */
export function parseGitHubPRUrl(url: string): ParsedGitHubPR | null {
  const trimmed = url.trim();
  const match = trimmed.match(GITHUB_PR_REGEX);
  if (!match) return null;

  const [, owner, repo, numberStr] = match;
  const prNumber = parseInt(numberStr, 10);

  if (isNaN(prNumber) || prNumber <= 0) return null;

  return {
    owner: owner.toLowerCase(),
    repo: repo.toLowerCase(),
    prNumber,
  };
}

/**
 * Create an invalid-URL error.
 */
export function createInvalidUrlError(message = "Invalid GitHub PR URL"): GitHubError {
  return {
    code: "INVALID_URL",
    message,
  };
}
