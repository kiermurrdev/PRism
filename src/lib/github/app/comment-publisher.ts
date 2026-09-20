/**
 * PR comment publishing for the GitHub App integration.
 *
 * Creates or updates a single idempotent PRism analysis comment on each PR.
 * Uses installation access tokens obtained via the auth layer. All HTTP calls
 * are injectable for testing. No Nemotron analysis runs in the webhook path.
 *
 * SERVER-ONLY. Do not import this module into client-side code. Includes temporary API diagnostics.
 */

import type { NormalizedWebhookEvent, PRCommentMarker } from "./contracts";
import { buildMarkerBlock } from "./markers";
import { createJwt, type JwtConfig, type Clock, type JwtCrypto } from "./jwt";
import { getInstallationAccessToken, type FetchFn } from "./token";
import { buildAnalysisLink } from "@/lib/analysis/analysis-link";

/**
 * GitHub API base URL.
 */
const GITHUB_API_BASE = "https://api.github.com";

/**
 * Result of a comment publishing attempt.
 */
export type PublishResult =
  | { ok: true; action: "created"; commentId: number }
  | { ok: true; action: "updated"; commentId: number }
  | { ok: true; action: "no-op"; reason: string }
  | { ok: false; error: PublishError };

/**
 * Error codes for comment publishing.
 */
export type PublishErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "GITHUB_ERROR"
  | "NETWORK_ERROR"
  | "MISSING_CONFIGURATION"
  | "COMMENT_NOT_FOUND";

/**
 * A typed publishing error.
 */
export interface PublishError {
  code: PublishErrorCode;
  message: string;
}

/**
 * Configuration for the comment publisher.
 */
export interface CommentPublisherConfig {
  /** GitHub App ID. */
  appId: number;
  /** PEM-encoded private key. */
  privateKey: string;
  /** App slug (used to identify bot author). */
  appSlug: string;
  /** Application base URL for analysis links. */
  appUrl: string;
}

/**
 * A GitHub issue comment as returned by the API.
 */
interface GitHubComment {
  id: number;
  body: string;
  user?: {
    login?: string;
    type?: string;
  };
}

/**
 * A GitHub App user as returned by the API.
 */
interface GitHubAppUser {
  login: string;
  id: number;
}

/**
 * Build the Markdown body for a PRism analysis comment.
 */
export function buildCommentBody(
  prTitle: string,
  prUrl: string,
  headSha: string,
  appUrl: string,
): string {
  const analysisPath = buildAnalysisLink(prUrl);
  const analysisLink = new URL(analysisPath, appUrl).toString();
  const shortSha = headSha.slice(0, 7);

  return `# PRism Analysis

Review the architectural impact of this PR.

**PR:** ${prTitle}
**Head SHA:** \`${shortSha}\`

[View analysis report](${analysisLink})

> Opening the link runs or refreshes the analysis for this PR.
`;
}

/**
 * Create the full PRism comment with markers.
 */
export function buildPrismComment(
  repo: string,
  prNumber: number,
  prTitle: string,
  prUrl: string,
  headSha: string,
  appUrl: string,
): string {
  const body = buildCommentBody(prTitle, prUrl, headSha, appUrl);
  return buildMarkerBlock(repo, prNumber, headSha, body);
}

/**
 * Classify a GitHub API error response.
 */
function classifyPublishError(status: number, headers: Headers): PublishError {
  if (status === 429 || headers.get("X-RateLimit-Remaining") === "0") {
    return {
      code: "RATE_LIMITED",
      message: "GitHub API rate limit exceeded.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: "AUTH_FAILED",
      message: "GitHub rejected the authentication token.",
    };
  }

  if (status >= 500) {
    return {
      code: "GITHUB_ERROR",
      message: "GitHub encountered an internal error.",
    };
  }

  return {
    code: "GITHUB_ERROR",
    message: "An unexpected error occurred while contacting GitHub.",
  };
}

/**
 * Check if a comment is owned by the PRism bot.
 */
function isPrismBotComment(comment: GitHubComment, appSlug: string): boolean {
  const user = comment.user;
  if (!user) return false;

  // Match by login: GitHub App users have login ending in "[bot]"
  const login = user.login ?? "";
  return login.endsWith("[bot]") && login.includes(appSlug);
}

/**
 * Find an existing PRism comment among PR comments.
 */
function findPrismComment(
  comments: GitHubComment[],
  repo: string,
  prNumber: number,
  appSlug: string,
): GitHubComment | null {
  for (const comment of comments) {
    // Must be a PRism bot comment
    if (!isPrismBotComment(comment, appSlug)) continue;

    // Must contain our marker for this PR
    const marker = comment.body.match(
      /<!-- PRISM_ANALYSIS_START:repo=([^:]+):pr=(\d+):sha=([a-f0-9]+) -->/,
    );
    if (!marker) continue;

    const [, markerRepo, markerPrStr] = marker;
    const markerPr = parseInt(markerPrStr, 10);

    if (markerRepo === repo && markerPr === prNumber) {
      return comment;
    }
  }

  return null;
}

/**
 * Options for publishing a comment.
 */
export interface PublishOptions {
  /** The webhook event that triggered publishing. */
  event: NormalizedWebhookEvent;
  /** Publisher configuration. */
  config: CommentPublisherConfig;
  /** Fetch implementation for testing. */
  fetchFn?: FetchFn;
  /** Clock for testing. */
  clock?: Clock;
  /** Crypto for testing. */
  jwtCrypto?: JwtCrypto;
}

/**
 * Publish or update the PRism analysis comment for a PR.
 *
 * This function:
 * 1. Obtains an installation access token via JWT + auth layer.
 * 2. Lists existing PR comments.
 * 3. Finds the existing PRism comment by marker and bot ownership.
 * 4. Creates or updates the comment idempotently.
 *
 * The webhook never waits for Nemotron analysis — the comment links to
 * the analysis page which runs/refreshes analysis on open.
 */
export async function publishPrComment(options: PublishOptions): Promise<PublishResult> {
  const { event, config, fetchFn, clock, jwtCrypto } = options;
  const effectiveFetch: FetchFn = fetchFn ?? globalThis.fetch;
  const { appId, privateKey, appSlug, appUrl } = config;
  const { installationId, repositoryFullName, prNumber, prUrl, prTitle, headSha } = event;

  // Step 1: Generate JWT
  const jwtConfig: JwtConfig = { appId, privateKey };
  const jwtResult = await createJwt(jwtConfig, clock, jwtCrypto);
  if (!jwtResult.ok) {
    return {
      ok: false,
      error: {
        code: "MISSING_CONFIGURATION",
        message: jwtResult.error.message,
      },
    };
  }

  // Step 2: Get installation access token
  const tokenResult = await getInstallationAccessToken(
    { jwt: jwtResult.jwt, installationId },
    effectiveFetch,
  );
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: {
        code: tokenResult.error.code === "GITHUB_RATE_LIMITED"
          ? "RATE_LIMITED"
          : "AUTH_FAILED",
        message: tokenResult.error.message,
      },
    };
  }

  const token = tokenResult.token;

  // Step 3: List existing PR comments
  const listUrl = `${GITHUB_API_BASE}/repos/${repositoryFullName}/issues/${prNumber}/comments`;
  let comments: GitHubComment[] = [];

  try {
    const listResponse = await effectiveFetch(listUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "PRism-GitHub-App",
      },
    });

    if (!listResponse.ok) {
      console.error("[github-webhook] list comments failed:", {
        status: listResponse.status,
        body: await listResponse.text(),
      });

      return {
        ok: false,
        error: classifyPublishError(listResponse.status, listResponse.headers),
      };
    }

    comments = await listResponse.json();
  } catch {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Failed to connect to GitHub to list comments.",
      },
    };
  }

  // Step 4: Find existing PRism comment
  const existingComment = findPrismComment(comments, repositoryFullName, prNumber, appSlug);

  // Build the new comment body
  const newCommentBody = buildPrismComment(
    repositoryFullName,
    prNumber,
    prTitle,
    prUrl,
    headSha,
    appUrl,
  );

  // Check if the existing comment already has the same SHA — no-op
  if (existingComment) {
    const existingMarker = existingComment.body.match(
      /<!-- PRISM_ANALYSIS_START:repo=([^:]+):pr=(\d+):sha=([a-f0-9]+) -->/,
    );
    if (existingMarker && existingMarker[3] === headSha) {
      return { ok: true, action: "no-op", reason: "Existing comment already has current SHA" };
    }

    // Step 5a: Update existing comment
    try {
      const updateUrl = `${GITHUB_API_BASE}/repos/${repositoryFullName}/issues/comments/${existingComment.id}`;
      const updateResponse = await effectiveFetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "PRism-GitHub-App",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: newCommentBody }),
      });

      if (!updateResponse.ok) {
        console.error("[github-webhook] update comment failed:", {
          status: updateResponse.status,
          body: await updateResponse.text(),
        });

        return {
          ok: false,
          error: classifyPublishError(updateResponse.status, updateResponse.headers),
        };
      }

      return { ok: true, action: "updated", commentId: existingComment.id };
    } catch {
      return {
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to GitHub to update comment.",
        },
      };
    }
  }

  // Step 5b: Create new comment
  try {
    const createResponse = await effectiveFetch(listUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "PRism-GitHub-App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: newCommentBody }),
    });

    if (!createResponse.ok) {
      console.error("[github-webhook] create comment failed:", {
        status: createResponse.status,
        body: await createResponse.text(),
      });

      return {
        ok: false,
        error: classifyPublishError(createResponse.status, createResponse.headers),
      };
    }

    const createdComment: { id: number } = await createResponse.json();
    return { ok: true, action: "created", commentId: createdComment.id };
  } catch {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Failed to connect to GitHub to create comment.",
      },
    };
  }
}
