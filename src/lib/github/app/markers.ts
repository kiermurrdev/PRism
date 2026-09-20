/**
 * Comment marker helpers for the GitHub App integration.
 *
 * Defines the format for PR comment markers that identify PRism-generated
 * comments and enable idempotent updates.
 */

import type { PRCommentMarker } from "./contracts";

const MARKER_START_PREFIX = "<!-- PRISM_ANALYSIS_START:";
const MARKER_END = "<!-- PRISM_ANALYSIS_END -->";

/**
 * Build the start marker comment for a PR analysis.
 *
 * Format: <!-- PRISM_ANALYSIS_START:repo={repo}:pr={prNumber}:sha={sha} -->
 */
export function buildMarkerStart(
  repo: string,
  prNumber: number,
  sha: string,
): string {
  return `${MARKER_START_PREFIX}repo=${repo}:pr=${prNumber}:sha=${sha} -->`;
}

/**
 * Build the full marker block (start + end) wrapping content.
 */
export function buildMarkerBlock(
  repo: string,
  prNumber: number,
  sha: string,
  content: string,
): string {
  const start = buildMarkerStart(repo, prNumber, sha);
  return `${start}\n${content}\n${MARKER_END}`;
}

/**
 * Parse a marker from a comment string.
 *
 * Returns the marker data if found, or null if the comment is not a PRism comment.
 */
export function parseMarker(comment: string): PRCommentMarker | null {
  const startMatch = comment.match(
    /<!-- PRISM_ANALYSIS_START:repo=([^:]+):pr=(\d+):sha=([a-f0-9]+) -->/,
  );
  if (!startMatch) return null;

  const [, repo, prStr, sha] = startMatch;
  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) return null;

  return { repo, prNumber, sha };
}

/**
 * Check whether a comment is a PRism-generated analysis comment.
 */
export function isPrismComment(comment: string): boolean {
  return comment.includes(MARKER_START_PREFIX) && comment.includes(MARKER_END);
}
