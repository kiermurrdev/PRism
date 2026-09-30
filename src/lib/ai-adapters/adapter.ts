import type { ReportData } from "@/types/report";

/**
 * Provider-neutral error codes.
 */
export type AdapterErrorCode =
  | "MISSING_CONFIG"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "AUTH_FAILURE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INVALID_JSON"
  | "SCHEMA_INVALID"
  | "SSRF_BLOCKED"
  | "ENDPOINT_INVALID";

/**
 * Normalized error returned by all adapters.
 */
export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
}

/**
 * Result of an AI analysis call.
 */
export type AdapterResult =
  | { ok: true; report: ReportData }
  | { ok: false; error: AdapterError };

/**
 * A single changed file as supplied by the GitHub ingestion layer.
 */
export interface ChangedFileContext {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * Analysis context passed to any adapter.
 */
export interface AnalysisContext {
  repo: string;
  prNumber: number;
  title: string;
  prUrl: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  changedFiles: ChangedFileContext[];
  repoContext?: string;
}

/**
 * Configuration options for adapter calls.
 */
export interface AdapterOptions {
  timeoutMs?: number;
}

/**
 * Capability metadata exposed by each adapter so the UI can
 * enable/disable structured-output features gracefully.
 */
export interface AdapterCapabilities {
  /** Supports native JSON mode / response_format enforcement. */
  supportsStructuredOutput: boolean;
  /** Supports system prompts. */
  supportsSystemPrompt: boolean;
  /** Maximum recommended tokens for a single completion. */
  maxTokens: number;
}

/**
 * Provider-neutral interface for AI analysis.
 *
 * All AI providers implement this interface. The core analysis
 * pipeline depends only on this contract, never on provider-specific
 * types or implementations.
 */
export interface AiProviderAdapter {
  /**
   * Unique identifier for this provider (e.g. "nvidia", "openai").
   */
  readonly providerId: string;

  /**
   * Model ID this adapter instance is configured for.
   */
  readonly modelId: string;

  /**
   * Capabilities of this adapter.
   */
  readonly capabilities: AdapterCapabilities;

  /**
   * Analyze a pull request and return a validated report.
   *
   * @param context - PR and repository context to analyze.
   * @param options - Optional call configuration (timeout, etc.).
   * @returns A validated ReportData or a normalized error.
   */
  analyze(
    context: AnalysisContext,
    options?: AdapterOptions
  ): Promise<AdapterResult>;
}

/**
 * Metadata about a completed analysis.
 */
export interface AnalysisMetadata {
  provider: string;
  model: string;
  analyzedAt: string;
  headSha: string;
}

/**
 * Full analysis result combining report and metadata.
 */
export interface AnalysisResultWithMetadata {
  report: ReportData;
  metadata: AnalysisMetadata;
}
