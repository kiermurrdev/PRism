"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ANALYSIS_RESULT_KEY } from "@/lib/analysis/constants";

const STAGES = [
  "Reading pull request",
  "Mapping repository components",
  "Tracing downstream effects",
  "Generating QA checklist",
];

type AnalysisState =
  | { type: "analyzing" }
  | { type: "success" }
  | { type: "error"; message: string };

export type { AnalysisState };

interface AnalysisProgressProps {
  /** The original PR URL used for the demo/example fallback */
  prUrl: string;
  /** Current analysis state driven by the caller */
  state: AnalysisState;
  /** Called when the user clicks Retry */
  onRetry?: () => void;
  /** Called when the user clicks Back */
  onBack?: () => void;
}

export function AnalysisProgress({
  prUrl,
  state,
  onRetry,
  onBack,
}: AnalysisProgressProps) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = React.useState(0);
  const [completed, setCompleted] = React.useState(false);

  React.useEffect(() => {
    if (state.type !== "analyzing") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stageDuration = reducedMotion ? 400 : 800;

    let stage = 0;
    const interval = setInterval(() => {
      stage += 1;
      if (stage >= STAGES.length) {
        clearInterval(interval);
        setCompleted(true);
      } else {
        setCurrentStage((prev) => prev + 1);
      }
    }, stageDuration);

    return () => clearInterval(interval);
  }, [state.type]);

  // When analysis succeeds, navigate based on whether the result is live or mock.
  React.useEffect(() => {
    if (state.type !== "success") return;

    const timer = setTimeout(() => {
      // Check the stored result to decide where to navigate.
      const stored = sessionStorage.getItem(ANALYSIS_RESULT_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.metadata?.source === "mock") {
            router.push(`/report/demo?pr=${encodeURIComponent(prUrl)}`);
            return;
          }
        } catch {
          // fall through to live path on parse error
        }
      }
      router.push("/report");
    }, 300);

    return () => clearTimeout(timer);
  }, [state.type, prUrl, router]);

  const progressPercent = Math.round(((currentStage + (completed ? 1 : 0)) / STAGES.length) * 100);

  if (state.type === "error") {
    return (
      <div className="w-full max-w-xl mx-auto text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#111827] border border-[#273449] mb-4">
            <AlertCircle className="w-6 h-6 text-[#EF4444]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Analysis failed</h2>
          <p className="text-[#94A3B8] text-sm max-w-sm mx-auto">{state.message}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
                "bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] text-[#090D18]",
                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]",
                "transition-opacity"
              )}
            >
              <Loader2 className="w-4 h-4" aria-hidden="true" />
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => onBack?.() ?? router.push("/")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
              "border border-[#273449] bg-[#111827] text-[#F8FAFC]",
              "hover:bg-[#182235] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]",
              "transition-colors"
            )}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-[#94A3B8] mb-2">
          <span>Analysis in progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#111827] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      <ol className="space-y-3" aria-label="Analysis stages">
        {STAGES.map((label, index) => {
          const isCompleted = index < currentStage || completed;
          const isActive = index === currentStage && !completed;

          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                isActive && "bg-[#111827] border border-[#273449]"
              )}
            >
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-[#22D3EE]" aria-hidden="true" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-[#8B5CF6] animate-spin" aria-hidden="true" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#273449]" aria-hidden="true" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  isCompleted && "text-[#F8FAFC]",
                  isActive && "text-[#F8FAFC] font-medium",
                  !isCompleted && !isActive && "text-[#64748B]"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
