"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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

interface PersistedReport {
  id: string;
  jobId: string;
  repositoryId: string;
  headSha: string;
  provider: string | null;
  model: string | null;
  promptVersion: string;
  schemaVersion: string;
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

interface LoadError {
  code: string;
  message: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: LoadError }
  | { status: "success"; data: PersistedReport };

export default function PersistedReportPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params?.reportId as string | undefined;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedNode, setSelectedNode] = useState<ReportNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setState({ status: "error", error: { code: "MISSING_ID", message: "No report ID provided." } });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}`, {
          signal: controller.signal,
        });
        if (cancelled) return;

        if (!res.ok) {
          const body = (await res.json()) as LoadError;
          setState({ status: "error", error: body });
          return;
        }

        const data = (await res.json()) as PersistedReport;
        if (cancelled) return;
        setState({ status: "success", data });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load report.";
        setState({ status: "error", error: { code: "LOAD_FAILED", message: msg } });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reportId]);

  const nodesById = useMemo(() => {
    if (state.status === "success") {
      return new Map<string, ReportNode>(state.data.nodes.map((n) => [n.id, n]));
    }
    return new Map<string, ReportNode>();
  }, [state]);

  const handleNodeSelect = (node: ReportNode) => {
    setSelectedNode(node);
    setPanelOpen(true);
  };

  // Loading state
  if (state.status === "loading") {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--background)]">
        <main className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-xl text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] mb-4">
                <span className="animate-pulse text-xl" aria-hidden="true">⏳</span>
              </div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Loading report...
              </h1>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (state.status === "error") {
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
                {state.error.message}
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

  const data = state.data;
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
                  Saved report
                </span>
              </div>
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                {data.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>head: {data.headSha.slice(0, 7)}</span>
                <span>
                  analyzed:{" "}
                  {new Date(data.analyzedAt).toLocaleString()}
                </span>
                {data.provider && data.model && (
                  <span>
                    model: {data.provider}/{data.model}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <div className="grid gap-6 md:grid-cols-12">
            <div className="order-2 md:order-1 md:col-span-8">
              <ImpactGraph
                nodes={data.nodes}
                edges={data.edges}
                selectedNodeId={selectedNode?.id}
                onNodeSelect={handleNodeSelect}
              />
            </div>

            <div className="order-1 md:order-2 md:col-span-4 flex flex-col gap-4">
              <ChangeSummaryCard summary={data.summary} />
              <ImpactFindings
                findings={data.findings}
                nodesById={nodesById}
              />
            </div>
          </div>

          <ImpactLegend />

          <div className="grid gap-6 md:grid-cols-2">
            <QAChecklist items={data.qaItems} />
            <AffectedFiles files={data.affectedFiles} />
          </div>
        </div>
      </main>

      <NodeDetailsPanel
        node={selectedNode}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </div>
  );
}
