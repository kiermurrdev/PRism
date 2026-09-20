"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { ANALYSIS_RESULT_KEY } from "@/lib/analysis/constants";
import { analyzePr } from "@/lib/analysis/request";
import type { AnalysisSnapshot } from "@/types/analysis";

/**
 * Example PR URL used for the guaranteed mock path.
 */
const EXAMPLE_PR_URL = "https://github.com/plausible/analytics/pull/6232";

/**
 * Parses a GitHub PR URL into { repo, prNumber }.
 */
function parsePrUrl(url: string): { repo: string; prNumber: number } | null {
  const match = url.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { repo: match[1], prNumber: parseInt(match[2], 10) };
}

type AnalysisState =
  | { type: "analyzing"; snapshot?: AnalysisSnapshot }
  | { type: "success" }
  | { type: "error"; message: string };

export function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prUrl = searchParams.get("pr");

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    type: "analyzing",
  });
  const submitting = useRef(false);
  const didMount = useRef(false);

  const runAnalysis = useCallback(async () => {
    if (!prUrl || submitting.current) return;
    submitting.current = true;

    const parsed = parsePrUrl(prUrl);
    if (!parsed) {
      setAnalysisState({
        type: "error",
        message: "That doesn't look like a GitHub pull request URL.",
      });
      submitting.current = false;
      return;
    }

    // The example PR is guaranteed to use mock data — no API call.
    if (prUrl === EXAMPLE_PR_URL) {
      try {
        const mockResult = await import("@/data/mock-report").then(
          (m) => m.mockReport
        );
        sessionStorage.setItem(
          ANALYSIS_RESULT_KEY,
          JSON.stringify({
            ...mockResult,
            prUrl,
            metadata: {
              source: "mock" as const,
              analyzedAt: new Date().toISOString(),
              headSha:
                "0000000000000000000000000000000000000000",
            },
          })
        );
        setAnalysisState({ type: "success" });
      } catch {
        setAnalysisState({
          type: "error",
          message: "Could not load the example. Please try again.",
        });
      } finally {
        submitting.current = false;
      }
      return;
    }

    // Live analysis via the API route with streaming progress.
    try {
      const result = await analyzePr(parsed.repo, parsed.prNumber, {
        onStage: (snapshot) => {
          setAnalysisState({ type: "analyzing", snapshot });
        },
      });
      sessionStorage.setItem(ANALYSIS_RESULT_KEY, JSON.stringify(result));
      setAnalysisState({ type: "success" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setAnalysisState({ type: "error", message });
    } finally {
      submitting.current = false;
    }
  }, [prUrl]);

  // Trigger analysis once on mount if a PR URL is present.
  useEffect(() => {
    if (!didMount.current && prUrl) {
      didMount.current = true;
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prUrl]);

  if (!prUrl) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <main className="flex flex-col items-center justify-center gap-6 py-32 px-8 max-w-xl text-center">
          <div className="rounded-full bg-[#111827] border border-[#273449] w-12 h-12 flex items-center justify-center mb-2">
            <span className="text-xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold">Missing pull request URL</h1>
          <p className="text-[#94A3B8]">
            No PR URL was provided. Please start from the home page and enter a
            pull request URL to analyze.
          </p>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
              "bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] text-[#090D18]",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]",
              "transition-opacity"
            )}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Return home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <main className="flex flex-col items-center justify-center gap-8 py-32 px-8 max-w-xl">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Analyzing pull request</h1>
          <p className="text-[#94A3B8] text-sm truncate max-w-md mx-auto">
            {prUrl}
          </p>
        </div>
        <AnalysisProgress
          prUrl={prUrl}
          state={analysisState}
          onRetry={runAnalysis}
          onBack={() => router.push("/")}
        />
      </main>
    </div>
  );
}
