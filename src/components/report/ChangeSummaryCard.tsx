"use client";

import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ChangeSummaryCardProps {
  /** The plain-English summary of the pull request changes. */
  summary?: string;
  className?: string;
}

export default function ChangeSummaryCard({
  summary,
  className,
}: ChangeSummaryCardProps) {
  const cardClasses = cn(
    "rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4",
    className,
  );

  if (!summary || summary.trim() === "") {
    return (
      <section aria-label="Change summary" className={cardClasses}>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <FileText
            aria-hidden="true"
            className="h-6 w-6 text-[var(--text-muted)]"
          />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No summary available
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
            The analysis has not yet generated a summary for this pull request.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Change summary" className={cardClasses}>
      <div className="flex items-start gap-2">
        <FileText
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-cyan)]"
        />
        <p className="text-sm leading-relaxed text-[var(--text-primary)]">
          {summary}
        </p>
      </div>
    </section>
  );
}
