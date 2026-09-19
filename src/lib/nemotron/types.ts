import type { ReportData } from "@/types/report";

/**
 * Error codes returned by the Nemotron client.
 */
export type NemotronErrorCode =
  | "MISSING_CONFIG"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "AUTH_FAILURE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INVALID_JSON"
  | "SCHEMA_INVALID";

/**
 * Typed error returned by the Nemotron client.
 */
export interface NemotronError {
  code: NemotronErrorCode;
  message: string;
}

/**
 * Result of a Nemotron analysis call.
 */
export type NemotronResult =
  | { ok: true; report: ReportData }
  | { ok: false; error: NemotronError };

/**
 * A single changed file as supplied by the GitHub ingestion layer.
 * Used to ground file paths and statistics in the prompt.
 */
export interface ChangedFileContext {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * Context passed to the Nemotron analyzer.
 *
 * All PR metadata and file statistics are deterministic and supplied
 * by upstream layers (GitHub ingestion). The model must not invent
 * or override these values.
 */
export interface NemotronContext {
  /** Repository identifier, e.g. "owner/repo". */
  repo: string;
  /** PR number. */
  prNumber: number;
  /** PR title. */
  title: string;
  /** PR URL. */
  prUrl: string;
  /** Head commit SHA. */
  headSha: string;
  /** Base branch name. */
  baseBranch: string;
  /** Head branch name. */
  headBranch: string;
  /** Changed files with deterministic statistics from GitHub. */
  changedFiles: ChangedFileContext[];
  /**
   * Optional repository context (file tree, key files) to help the
   * model understand the project structure.
   */
  repoContext?: string;
}

/**
 * Configuration options for the Nemotron client.
 */
export interface NemotronClientOptions {
  /**
   * Request timeout in milliseconds. Defaults to 60000.
   */
  timeoutMs?: number;
}

/**
 * Default timeout for Nemotron requests (60 seconds).
 */
export const DEFAULT_TIMEOUT_MS = 60_000;
