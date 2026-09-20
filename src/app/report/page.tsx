"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { loadAnalysisResult } from "@/lib/analysis/load-result";
import type { ReportNode } from "@/types/report";
import type { AnalysisResult } from "@/types/analysis";
import type { LoadResultError } from "@/lib/analysis/load-result";
import ImpactGraph from "@/components/report/ImpactGraph";
import ChangeSummaryCard from "@/components/report/ChangeSummaryCard";
import ImpactFindings from "@/components/report/ImpactFindings";
import { QAChecklist } from "@/components/report/QAChecklist";
import AffectedFiles from "@/components/report/AffectedFiles";
import NodeDetailsPanel from "@/components/report/NodeDetailsPanel";
import ImpactLegend from "@/components/report/ImpactLegend";
import ReportActions from "@/components/report/ReportActions";

type LoadedResult = { result: AnalysisResult } | { error: LoadResultError };

export default function LiveReportPage() {
  const router = useRouter();
  const [result] = useState<LoadedResult>(() => {
    // Only runs on client during initial render
    return typeof window !== "undefined" ? loadAnalysisResult() : ({ error: { kind: "missing" as const, message: "Loading..." } } as LoadedResult);
  });
  const [selectedNode, setSelectedNode] = useState<ReportNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const nodesById = useMemo(() => {
    if ("result" in result && result.result) {
      return new Map<string, ReportNode>(result.result.nodes.map((n: ReportNode) => [n.id, n]));
    }
    return new Map<string, ReportNode>();
  }, [result]);

  const handleNodeSelect = (node: ReportNode) => {
    setSelectedNode(node);
    setPanelOpen(true);
  };

  const handleAnalyzeAgain = (prUrl: string) => {
    const encoded = btoa(prUrl);
    router.push(`/analyze?pr=${encoded}`);
  };

  // Missing / invalid result state
  if (!result || "error" in result) {
    const message = "error" in result ? result.error?.message ?? "Unable to load report." : "Loading...";
    return (
      <div className="flex flex-col min-h-screen bg-[var(--background)]">
        <main className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-xl text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] mb-4">
                <span className="text-xl" aria-hidden="true">⚠️</span>
              </div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Report not available
              </h1>
              <p className="text-[var(--text-muted)] text-sm max-w-sm mx-auto">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
                "bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-cyan)] text-[var(--background)]",
                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-purple)]",
                "transition-opacity"
              )}
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Return home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const data = result.result;

  // Extract repo/pr info from prUrl for the header
  const prUrlParts = data.prUrl.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
  const repo = prUrlParts ? prUrlParts[1] : "unknown/repo";
  const prNumber = prUrlParts ? prUrlParts[2] : "?";

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Report header */}
      <header className="w-full border-b border-[var(--border)] bg-[var(--surface)] px-6 py-5">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                  {repo}
                </h1>
                <a
                  href={data.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--accent-cyan)] transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  PR #{prNumber}
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
                <span className="inline-flex items-center rounded-full bg-[var(--accent-purple)]/20 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-purple)]">
                  Live analysis
                </span>
              </div>
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                {data.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                {data.metadata.headSha && (
                  <span>head: {data.metadata.headSha.slice(0, 7)}</span>
                )}
                {data.metadata.analyzedAt && (
                  <span>
                    analyzed:{" "}
                    {new Date(data.metadata.analyzedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Report actions */}
            <ReportActions result={data} onAnalyzeAgain={handleAnalyzeAgain} />
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-[1280px] space-y-6">
          {/* Desktop: graph (8 cols) + summary/findings (4 cols) */}
          {/* Mobile: summary first, then graph */}
          <div className="grid gap-6 md:grid-cols-12">
            {/* Graph — mobile: after summary; desktop: left 8 cols */}
            <div className="order-2 md:order-1 md:col-span-8">
              <ImpactGraph
                nodes={data.nodes}
                edges={data.edges}
                selectedNodeId={selectedNode?.id}
                onNodeSelect={handleNodeSelect}
              />
            </div>

            {/* Summary + findings — mobile: first; desktop: right 4 cols */}
            <div className="order-1 md:order-2 md:col-span-4 flex flex-col gap-4">
              <ChangeSummaryCard summary={data.summary} />
              <ImpactFindings
                findings={data.findings}
                nodesById={nodesById}
              />
            </div>
          </div>

          {/* Legend */}
          <ImpactLegend />

          {/* QA checklist + affected files */}
          {/* Desktop: equal-width; Mobile: stacked in spec order */}
          <div className="grid gap-6 md:grid-cols-2">
            <QAChecklist items={data.qaItems} />

            {/* Affected files */}
            <AffectedFiles files={data.affectedFiles} />
          </div>
        </div>
      </main>

      {/* Node details panel */}
      <NodeDetailsPanel
        node={selectedNode}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </div>
  );
}
