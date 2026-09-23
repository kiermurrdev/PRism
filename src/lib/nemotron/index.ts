/**
 * @deprecated Use `@/lib/ai-adapters/nemotron` instead.
 *
 * Thin compatibility shim that delegates to the new NemotronAdapter.
 * Kept so existing tests and callers continue to work without changes.
 */

import { NemotronAdapter } from "@/lib/ai-adapters/nemotron";
import type { NemotronContext, NemotronResult, NemotronOptions } from "./types";
import type { AdapterOptions } from "@/lib/ai-adapters/adapter";

export { MAX_REPAIR_ATTEMPTS } from "@/lib/ai-adapters/nemotron/constants";
export { NemotronAdapter } from "@/lib/ai-adapters/nemotron";

/**
 * Map old NemotronContext to the new AnalysisContext shape.
 */
function toAnalysisContext(ctx: NemotronContext) {
  return {
    repo: ctx.repo,
    prNumber: ctx.prNumber,
    title: ctx.title,
    prUrl: ctx.prUrl,
    headSha: ctx.headSha,
    baseBranch: ctx.baseBranch,
    headBranch: ctx.headBranch,
    changedFiles: ctx.changedFiles.map((f) => ({
      path: f.path,
      status: f.status as "added" | "modified" | "deleted",
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    repoContext: ctx.repoContext,
  };
}

export async function analyzeWithNemotron(
  context: NemotronContext,
  options?: NemotronOptions
): Promise<NemotronResult> {
  const adapter = new NemotronAdapter();
  const adapterOptions: AdapterOptions = options
    ? { timeoutMs: options.timeoutMs }
    : undefined;

  const result = await adapter.analyze(toAnalysisContext(context), adapterOptions);

  if (result.ok) {
    return { ok: true, report: result.report };
  }

  return { ok: false, error: result.error };
}
