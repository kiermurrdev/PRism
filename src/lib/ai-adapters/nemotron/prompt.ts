/**
 * Prompt builder for Nemotron analysis.
 *
 * Assembles the analysis prompt from the provided context.
 */

import type { AnalysisContext } from "../adapter";

export function buildPrompt(context: AnalysisContext): string {
  const parts: string[] = [];

  parts.push("=== ANALYSIS REQUEST ===");
  parts.push(`Repository: ${context.repo}`);
  parts.push(`PR: ${context.prUrl}`);
  parts.push(`Title: ${context.title}`);
  parts.push(`Head SHA: ${context.headSha}`);
  parts.push(`Base Branch: ${context.baseBranch}`);
  parts.push(`Head Branch: ${context.headBranch}`);
  parts.push("");

  // Include repo context if provided
  if (context.repoContext) {
    parts.push(context.repoContext);
    parts.push("");
  }

  parts.push("=== CHANGED FILES ===");
  for (const file of context.changedFiles) {
    parts.push(`--- ${file.path} (${file.status}) ---`);
    parts.push(`+${file.additions} -${file.deletions}`);
    if (file.patch) {
      parts.push(file.patch);
    }
    parts.push("");
  }

  parts.push("=== INSTRUCTIONS ===");
  parts.push("Analyze this pull request and return a JSON object with the specified structure.");
  parts.push("Identify risks, downstream impacts, and QA requirements.");

  return parts.join("\n");
}
