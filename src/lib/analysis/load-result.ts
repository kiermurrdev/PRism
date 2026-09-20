import { ANALYSIS_RESULT_KEY } from "./constants";
import { AnalysisResultSchema } from "./schema";
import type { AnalysisResult } from "@/types/analysis";

/**
 * Error type returned when the live analysis result cannot be loaded.
 */
export interface LoadResultError {
  kind: "missing" | "malformed" | "invalid";
  message: string;
}

/**
 * Loads and validates the live analysis result from session storage.
 *
 * Returns { result } on success or { error } when the data is missing,
 * malformed, or fails schema validation.
 */
export function loadAnalysisResult():
  | { result: AnalysisResult }
  | { error: LoadResultError } {
  const raw = sessionStorage.getItem(ANALYSIS_RESULT_KEY);

  if (raw === null) {
    return {
      error: {
        kind: "missing",
        message:
          "No analysis result found. Please run an analysis first or return to the home page.",
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      error: {
        kind: "malformed",
        message:
          "The stored analysis result is corrupted. Please run a new analysis.",
      },
    };
  }

  const validation = AnalysisResultSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      error: {
        kind: "invalid",
        message:
          "The stored analysis result is no longer valid. Please run a new analysis.",
      },
    };
  }

  return { result: validation.data };
}
