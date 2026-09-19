import type { ReportData } from "./report";

/**
 * Source of the report data.
 * "mock" = example/demo data
 * "live" = produced by the analysis pipeline
 */
export type ReportSource = "mock" | "live";

/**
 * Metadata attached to a live analysis result.
 */
export interface AnalysisMetadata {
  source: ReportSource;
  analyzedAt: string;
  headSha: string;
}

/**
 * The complete live analysis result.
 * Extends the canonical ReportData with analysis metadata.
 */
export interface AnalysisResult extends ReportData {
  metadata: AnalysisMetadata;
}

/**
 * Request payload for triggering a live PR analysis.
 */
export interface AnalysisRequest {
  repo: string;
  prNumber: number;
}

/**
 * Intermediate snapshot emitted while analysis is in progress.
 */
export interface AnalysisSnapshot {
  status: "fetching" | "analyzing" | "generating";
  message: string;
}

/**
 * Safe error response returned to the frontend.
 * No internal stack traces or secrets.
 */
export interface AnalysisError {
  code: string;
  message: string;
}
