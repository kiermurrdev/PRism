"use client";

import { AlertTriangle, HelpCircle, Info } from "lucide-react";

import { IMPACT_META } from "@/lib/impact-meta";
import { cn } from "@/lib/utils";
import type { ImpactFinding, ReportNode } from "@/types/report";

const SEVERITY_META: Record<
  ImpactFinding["severity"],
  { label: string; colorVar: string; icon: typeof AlertTriangle }
> = {
  high: {
    label: "High",
    colorVar: "--status-possible",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    colorVar: "--status-direct",
    icon: Info,
  },
  low: {
    label: "Low",
    colorVar: "--status-changed",
    icon: Info,
  },
};

/** Derives the highest impact level from affected nodes. */
function deriveImpactLevel(
  affectedNodeIds: string[],
  nodesById: Map<string, ReportNode>,
): keyof typeof IMPACT_META | null {
  if (affectedNodeIds.length === 0) return null;

  const order: (keyof typeof IMPACT_META)[] = ["direct", "possible", "unchanged"];
  for (const level of order) {
    if (affectedNodeIds.some((id) => nodesById.get(id)?.impact === level)) {
      return level;
    }
  }
  return null;
}

export interface ImpactFindingCardProps {
  finding: ImpactFinding;
  /** Map of node id to ReportNode, used to resolve impact levels and labels. */
  nodesById: Map<string, ReportNode>;
}

export default function ImpactFindingCard({
  finding,
  nodesById,
}: ImpactFindingCardProps) {
  const sevMeta = SEVERITY_META[finding.severity];
  const SevIcon = sevMeta.icon;
  const impactLevel = deriveImpactLevel(finding.affectedNodes, nodesById);
  const impactMeta = impactLevel ? IMPACT_META[impactLevel] : null;
  const ImpactIcon = impactMeta?.icon ?? HelpCircle;

  const affectedLabels = finding.affectedNodes
    .map((id) => nodesById.get(id)?.label)
    .filter(Boolean) as string[];

  return (
    <article
      className={cn(
        "rounded-xl border bg-[var(--surface-elevated)] p-4",
        "transition-colors",
      )}
      style={{ borderColor: "var(--border)" }}
      aria-label={`Finding: ${finding.title}`}
    >
      <div className="flex items-start gap-2">
        <SevIcon
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: `var(${sevMeta.colorVar})` }}
        />
        <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {finding.title}
        </h3>
      </div>

      <p className="mt-2 pl-6 text-xs leading-relaxed text-[var(--text-muted)]">
        {finding.description}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 pl-6">
        {/* Confidence level (from severity) */}
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: `var(${sevMeta.colorVar})` }}
          />
          <span className="text-[var(--text-muted)]">Confidence:</span>
          <span style={{ color: `var(${sevMeta.colorVar})` }}>
            {sevMeta.label}
          </span>
        </span>

        {/* Impact level (derived from affected nodes) */}
        {impactMeta && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none">
            <ImpactIcon
              aria-hidden="true"
              className="h-2.5 w-2.5"
              style={{ color: `var(${impactMeta.cssVar})` }}
            />
            <span className="text-[var(--text-muted)]">Impact:</span>
            <span style={{ color: `var(${impactMeta.cssVar})` }}>
              {impactMeta.label}
            </span>
          </span>
        )}
      </div>

      {/* Referenced components */}
      {affectedLabels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pl-6">
          {affectedLabels.map((label) => (
            <span
              key={label}
              title={label}
              className="inline-flex max-w-full items-center truncate rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] leading-none text-[var(--text-muted)]"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
