"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReportNode } from "@/types/report";
import ImpactGraph from "@/components/report/ImpactGraph";
import ChangeSummaryCard from "@/components/report/ChangeSummaryCard";
import ImpactFindings from "@/components/report/ImpactFindings";
import { QAChecklist } from "@/components/report/QAChecklist";
import AffectedFiles from "@/components/report/AffectedFiles";
import NodeDetailsPanel from "@/components/report/NodeDetailsPanel";
import ImpactLegend from "@/components/report/ImpactLegend";
import ReportActions from "@/components/report/ReportActions";

interface PersistedReport {
  id: string;
  headSha: string;
  provider: string | null;
  model: string | null;
  analyzedAt: string;
  title: string;
  prUrl: string;
  summary: string;
  nodes: ReportNode[];
  edges: { id: string; source: string; target: string }[];
  findings: {
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    affectedNodes: string[];
  }[];
  qaItems: { id: string; description: string; checked: boolean }[];
  affectedFiles: {
    path: string;
    status: "added" | "modified" | "deleted";
    additions: number;
    deletions: number;
    changeType: string;
  }[];
}

type LoadedResult =
  | { kind: "persisted"; data: PersistedReport }
  | { kind: "error"; error: { kind: string; message: string } };

export default function LiveReportPage() {
  const router = useRouter();
  const [result, setResult] = useState<LoadedResult>({
    kind: "error",
    error: { kind: "missing", message: "Loading..." },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const prUrl = sessionStorage.getItem("prism_analysis_prUrl");
      const repo = sessionStorage.getItem("prism_analysis_repo");
      const prNumber = sessionStorage.getItem("prism_analysis_prNumber");
      const headSha = sessionStorage.getItem("prism_analysis_headSha");

      if ((prUrl || (repo && prNumber)) && headSha) {
        try {
          const params = new URLSearchParams();
          if (prUrl) params.set("prUrl", prUrl);
          if (repo) params.set("repo", repo);
          if (prNumber) params.set("prNumber", prNumber);
          if (headSha) params.set("headSha", headSha);

          const res = await fetch(`/api/reports/by-pr?${params.toString()}`, {
            signal: controller.signal,
          });
          if (cancelled) return;

          if (res.ok) {
            const data = (await res.json()) as PersistedReport;
            if (!cancelled) {
              setResult({ kind: "persisted", data });
              return;
            }
          }
        } catch {
          // Fall through to error state
        }
      }

      if (!cancelled) {
        setResult({
          kind: "error",
          error: { kind: "missing", message: "No analysis result found. Run an analysis first." },
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);
  const [selectedNode, setSelectedNode] = useState<ReportNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const nodesById = useMemo(() => {
    if (result.kind === "persisted" && result.data.nodes) {
      return new Map<string, ReportNode>(result.data.nodes.map((n: ReportNode) => [n.id, n]));
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

  // Extract result data based on kind
  const hasResult = result.kind === "persisted";

  const errorKind = result.kind === "error" ? result.error : null;

  // Missing / invalid result state
  if (!hasResult || errorKind) {
    const message = errorKind?.message ?? "Unable to load report.";
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

  // Unified data access — persisted only
  const data = result.data;
  const title = data.title;
  const prUrl = data.prUrl;
  const summary = data.summary;
  const nodes = data.nodes;
  const edges = data.edges;
  const findings = data.findings;
  const qaItems = data.qaItems;
  const affectedFiles = data.affectedFiles;
  const headSha = data.headSha;
  const analyzedAt = data.analyzedAt;
  const provider = data.provider;
  const model = data.model;
  const isPersisted = true;

  const prUrlParts = prUrl.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
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
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--accent-cyan)] transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  PR #{prNumber}
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
                <span className="inline-flex items-center rounded-full bg-[var(--accent-purple)]/20 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-purple)]">
                  {isPersisted ? "Saved report" : "Live analysis"}
                </span>
              </div>
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                {title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                {headSha && (
                  <span>head: {headSha.slice(0, 7)}</span>
                )}
                {analyzedAt && (
                  <span>
                    analyzed:{" "}
                    {new Date(analyzedAt).toLocaleString()}
                  </span>
                )}
                {provider && model && (
                  <span>
                    model: {provider}/{model}
                  </span>
                )}
              </div>
            </div>

            {/* Report actions */}
            <ReportActions result={{ title, prUrl } as any} onAnalyzeAgain={handleAnalyzeAgain} />
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-[1280px] space-y-6">
          {/* Desktop: graph (8 cols) + summary/findings (4 cols) */}
          {/* Mobile: summary first, then graph */}
          <div className="grid gap-6 md:grid-cols-12">
            <div className="order-2 md:order-1 md:col-span-8">
              <ImpactGraph
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode?.id}
                onNodeSelect={handleNodeSelect}
              />
            </div>

            {/* Summary + findings — mobile: first; desktop: right 4 cols */}
            <div className="order-1 md:order-2 md:col-span-4 flex flex-col gap-4">
              <ChangeSummaryCard summary={summary} />
              <ImpactFindings
                findings={findings}
                nodesById={nodesById}
              />
            </div>
          </div>

          {/* Legend */}
          <ImpactLegend />

          {/* QA checklist + affected files */}
          {/* Desktop: equal-width; Mobile: stacked in spec order */}
          <div className="grid gap-6 md:grid-cols-2">
            <QAChecklist items={qaItems} />

            {/* Affected files */}
            <AffectedFiles files={affectedFiles} />
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
