"use client";

import { ListChecks } from "lucide-react";

import ImpactFindingCard from "@/components/report/ImpactFindingCard";
import { cn } from "@/lib/utils";
import type { ImpactFinding, ReportNode } from "@/types/report";

export interface ImpactFindingsProps {
  /** The list of possible impacts identified by the analysis. */
  findings: ImpactFinding[];
  /** Map of node id to ReportNode, used to resolve impact levels and labels. */
  nodesById: Map<string, ReportNode>;
  className?: string;
}

export default function ImpactFindings({
  findings,
  nodesById,
  className,
}: ImpactFindingsProps) {
  const sectionClasses = cn("flex flex-col gap-3", className);

  if (findings.length === 0) {
    return (
      <section aria-label="Impact findings" className={sectionClasses}>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Possible Impacts
        </h2>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-8 text-center">
          <ListChecks
            aria-hidden="true"
            className="h-6 w-6 text-[var(--text-muted)]"
          />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No possible impacts identified
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
            The analysis did not detect any areas that may require additional
            attention beyond the directly changed files.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Impact findings" className={sectionClasses}>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
        Possible Impacts
      </h2>
      <div className="flex flex-col gap-3">
        {findings.map((finding) => (
          <ImpactFindingCard
            key={finding.id}
            finding={finding}
            nodesById={nodesById}
          />
        ))}
      </div>
    </section>
  );
}
