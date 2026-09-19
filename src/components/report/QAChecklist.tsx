"use client";

import { useState } from "react";
import { QAItem } from "@/types/report";
import { cn } from "@/lib/utils";

interface QAChecklistProps {
  items: QAItem[];
}

export function QAChecklist({ items }: QAChecklistProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const checkedCount = checkedIds.size;
  const totalCount = items.length;

  const toggleItem = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = () => {
    const lines = items.map((item) => {
      const prefix = checkedIds.has(item.id) ? "- [x]" : "- [ ]";
      return `${prefix} ${item.description}`;
    });
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
          QA Checklist
        </h2>
        <p className="text-[var(--text-muted)]">
          No QA items available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">
            QA Checklist
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {checkedCount} of {totalCount} checked
          </p>
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            copied
              ? "border-[var(--accent-purple)] bg-[var(--accent-purple)] text-[var(--background)]"
              : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--border)]"
          )}
        >
          {copied ? "Copied!" : "Copy checklist"}
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 transition-colors hover:border-[var(--accent-purple)]"
              htmlFor={`qa-${item.id}`}
            >
              <input
                id={`qa-${item.id}`}
                type="checkbox"
                checked={checkedIds.has(item.id)}
                onChange={() => toggleItem(item.id)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent-purple)]"
                aria-label={item.description}
              />
              <span className={cn("text-sm", checkedIds.has(item.id) ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]")}>
                {item.description}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
