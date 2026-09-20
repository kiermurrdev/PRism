"use client";

import type { AnalysisResult } from "@/types/analysis";
import { ANALYSIS_API_PATH } from "@/lib/analysis/constants";
import { AnalysisRequestSchema, AnalysisResultSchema } from "@/lib/analysis/schema";

/**
 * Calls the live analysis API and returns a validated result.
 *
 * Does not navigate or mutate any shared state — that is the caller's
 * responsibility.
 */
export async function analyzePr(
  repo: string,
  prNumber: number
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
      // Non-JSON error body — use the default message.
    }
    throw new Error(message);
  }

  const data = await res.json();
  return AnalysisResultSchema.parse(data);
}
