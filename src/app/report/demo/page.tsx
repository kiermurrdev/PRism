"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import { mockReport } from "@/data/mock-report";
import type { ReportNode } from "@/types/report";
import ImpactGraph from "@/components/report/ImpactGraph";
import ChangeSummaryCard from "@/components/report/ChangeSummaryCard";
import ImpactFindings from "@/components/report/ImpactFindings";
import { QAChecklist } from "@/components/report/QAChecklist";
import AffectedFiles from "@/components/report/AffectedFiles";
import NodeDetailsPanel from "@/components/report/NodeDetailsPanel";
import ImpactLegend from "@/components/report/ImpactLegend";

export default function DemoReportPage() {
  const [selectedNode, setSelectedNode] = useState<ReportNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const nodesById = useMemo(
    () => new Map(mockReport.nodes.map((n) => [n.id, n])),
    [],
  );

  const handleNodeSelect = (node: ReportNode) => {
    setSelectedNode(node);
    setPanelOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Report header */}
      <header className="w-full border-b border-[var(--border)] bg-[var(--surface)] px-6 py-5">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                  example/ecommerce
                </h1>
                <a
                  href={mockReport.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--accent-cyan)] transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  PR #42
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
                <span className="inline-flex items-center rounded-full bg-[var(--accent-purple)]/20 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-purple)]">
                  Prototype data
                </span>
              </div>
              <h2 className="text-base font-medium text-[var(--text-primary)]">
                {mockReport.title}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>Author: example-dev</span>
                <span>base: main</span>
                <span>head: feat/coupon-support</span>
              </div>
            </div>
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
                nodes={mockReport.nodes}
                edges={mockReport.edges}
                selectedNodeId={selectedNode?.id}
                onNodeSelect={handleNodeSelect}
              />
            </div>

            {/* Summary + findings — mobile: first; desktop: right 4 cols */}
            <div className="order-1 md:order-2 md:col-span-4 flex flex-col gap-4">
              <ChangeSummaryCard summary={mockReport.summary} />
              <ImpactFindings
                findings={mockReport.findings}
                nodesById={nodesById}
              />
            </div>
          </div>

          {/* Legend */}
          <ImpactLegend />

          {/* QA checklist + affected files */}
          {/* Desktop: equal-width; Mobile: stacked in spec order */}
          <div className="grid gap-6 md:grid-cols-2">
            <QAChecklist items={mockReport.qaItems} />

            {/* Affected files — issue #9 component */}
            <AffectedFiles files={mockReport.affectedFiles} />
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
