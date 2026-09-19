"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const STAGES = [
  "Reading pull request",
  "Mapping repository components",
  "Tracing downstream effects",
  "Generating QA checklist",
];

export function AnalysisProgress({ prUrl }: { prUrl: string }) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = React.useState(0);
  const [completed, setCompleted] = React.useState(false);

  React.useEffect(() => {
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
  }, []);

  React.useEffect(() => {
    if (!completed) return;

    const timer = setTimeout(() => {
      router.push(`/report/demo?pr=${encodeURIComponent(prUrl)}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [completed, prUrl, router]);

  const progressPercent = Math.round(((currentStage + (completed ? 1 : 0)) / STAGES.length) * 100);

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-[#94A3B8] mb-2">
          <span>Analyzing</span>
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
