"use client";

import type { AnalysisResult, AnalysisSnapshot } from "@/types/analysis";
import { ANALYSIS_API_PATH } from "@/lib/analysis/constants";
import { AnalysisRequestSchema, AnalysisResultSchema } from "@/lib/analysis/schema";

export type AnalysisEvent =
  | { type: "stage"; snapshot: AnalysisSnapshot }
  | { type: "complete"; data: AnalysisResult }
  | { type: "error"; code: string; message: string };

interface AnalyzeOptions {
  onStage?: (snapshot: AnalysisSnapshot) => void;
}

/**
 * Calls the live analysis API and returns a validated result.
 * Streams real-time stage updates via onStage callback.
 */
export async function analyzePr(
  repo: string,
  prNumber: number,
  options: AnalyzeOptions = {}
): Promise<AnalysisResult> {
  const request = AnalysisRequestSchema.parse({ repo, prNumber });

  const res = await fetch(ANALYSIS_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    let message = `Analysis failed (${res.status}). Please try again.`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") {
        message = body.message;
      }
    } catch {
      // Non-JSON error body
    }
    throw new Error(message);
  }

  // Stream NDJSON events
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: AnalysisEvent;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (event.type === "stage") {
          options.onStage?.(event.snapshot);
        } else if (event.type === "error") {
          throw new Error(event.message);
        } else if (event.type === "complete") {
          return AnalysisResultSchema.parse(event.data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  throw new Error("Analysis stream ended without result.");
}
