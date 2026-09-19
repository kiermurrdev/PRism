"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export function AnalyzeContent() {
  const searchParams = useSearchParams();
  const prUrl = searchParams.get("pr");

  if (!prUrl) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <main className="flex flex-col items-center justify-center gap-6 py-32 px-8 max-w-xl text-center">
          <div className="rounded-full bg-[#111827] border border-[#273449] w-12 h-12 flex items-center justify-center mb-2">
            <span className="text-xl">⚠️</span>
          </div>
          <h1 className="text-xl font-semibold">Missing pull request URL</h1>
          <p className="text-[#94A3B8]">
            No PR URL was provided. Please start from the home page and enter a pull request URL to analyze.
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
        <AnalysisProgress prUrl={prUrl} />
      </main>
    </div>
  );
}
