/**
 * Internal types for GitHub PR ingestion.
 *
 * These types describe the bounded snapshot produced from a public GitHub PR.
 * They are used internally by the ingestion module and map into the shared
 * AnalysisResult / ReportData contract downstream.
 */

import type { AnalysisError } from "@/types/analysis";

/**
 * A single changed file in the PR diff.
 */
export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * A single entry in the bounded repository tree.
 */
export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
}

/**
 * Content of a selected manifest or configuration file.
 */
export interface ManifestContent {
  path: string;
  content: string;
}

/**
 * Truncation metadata recorded when limits are hit.
 */
export interface TruncationMetadata {
  /** Whether the list of changed files was truncated. */
  filesTruncated: boolean;
  /** Whether any individual patch was truncated. */
  patchesTruncated: boolean;
  /** Whether the repository tree listing was truncated. */
  treeTruncated: boolean;
  /** Whether the total collected text exceeded the limit. */
  totalTextTruncated: boolean;
}

/**
 * The bounded snapshot of a GitHub PR.
 */
export interface PRSnapshot {
  /** Repository name in "owner/repo" form. */
  repo: string;
  /** Pull request number. */
  prNumber: number;
  /** PR title. */
  title: string;
  /** PR author login. */
  author: string;
  /** Base branch name. */
  baseBranch: string;
  /** Head branch name. */
  headBranch: string;
  /** Head commit SHA. */
  headSha: string;
  /** Changed files (bounded and truncated if necessary). */
  changedFiles: ChangedFile[];
  /** Repository file tree (bounded). */
  tree: TreeEntry[];
  /** Selected manifest/config file contents. */
  manifests: ManifestContent[];
  /** Truncation metadata. */
  truncation: TruncationMetadata;
}

/**
 * Known error codes for GitHub ingestion.
 */
export type GitHubErrorCode =
  | "INVALID_URL"
  | "PR_NOT_FOUND"
  | "RATE_LIMITED"
  | "ACCESS_DENIED"
  | "TOO_LARGE"
  | "GITHUB_ERROR"
  | "NETWORK_ERROR";

/**
 * A typed error specific to GitHub ingestion.
 */
export interface GitHubError extends AnalysisError {
  code: GitHubErrorCode;
}
