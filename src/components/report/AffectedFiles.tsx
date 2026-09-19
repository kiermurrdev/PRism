"use client";

import { useMemo, useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AffectedFile, FileStatus } from "@/types/report";

/* ------------------------------------------------------------------ *
 * Status presentation
 *
 * The palette has no green token, so "added" borrows the cyan accent
 * rather than introducing a hex value. Every status carries a text
 * label and an icon, so colour is never the only signal.
 * ------------------------------------------------------------------ */

type StatusMeta = {
  label: string;
  color: string;
  Icon: LucideIcon;
};

const STATUS_META: Record<FileStatus, StatusMeta> = {
  added: { label: "Added", color: "var(--accent-cyan)", Icon: Plus },
  modified: { label: "Modified", color: "var(--status-changed)", Icon: Pencil },
  deleted: { label: "Deleted", color: "var(--status-possible)", Icon: Minus },
};

type StatusFilter = "all" | FileStatus;

const FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "added", label: "Added" },
  { value: "modified", label: "Modified" },
  { value: "deleted", label: "Deleted" },
];

function sumLines(files: readonly AffectedFile[]) {
  return files.reduce(
    (acc, file) => ({
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}

function tint(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ *
 * Path label
 *
 * No truncation: a hover-only tooltip hides the path from keyboard and
 * touch users. Directory segments get an explicit <wbr> so the browser
 * breaks on slashes, and the filename stays intact and emphasised.
 * ------------------------------------------------------------------ */

function FilePath({ path }: { path: string }) {
  const segments = path.split("/");
  const name = segments.pop() ?? path;

  return (
    <span className="min-w-0 flex-1 text-sm leading-snug break-words">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="text-[var(--muted)]">
          {segment}/<wbr />
        </span>
      ))}
      <span className="font-medium text-[var(--text)]">{name}</span>
    </span>
  );
}

function LineStats({
  additions,
  deletions,
  className,
}: {
  additions: number;
  deletions: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-baseline gap-2 text-sm tabular-nums",
        className,
      )}
    >
      <span className="sr-only">
        {plural(additions, "addition")}, {plural(deletions, "deletion")}
      </span>
      <span aria-hidden="true" style={{ color: "var(--accent-cyan)" }}>
        +{additions}
      </span>
      <span aria-hidden="true" style={{ color: "var(--status-possible)" }}>
        &minus;{deletions}
      </span>
    </span>
  );
}

export interface AffectedFilesProps {
  files: AffectedFile[];
  className?: string;
}

export function AffectedFiles({ files, className }: AffectedFilesProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const byStatus: Record<FileStatus, number> = {
      added: 0,
      modified: 0,
      deleted: 0,
    };
    for (const file of files) {
      byStatus[file.status] += 1;
    }
    return { all: files.length, ...byStatus };
  }, [files]);

  const visible = useMemo(
    () =>
      filter === "all" ? files : files.filter((file) => file.status === filter),
    [files, filter],
  );

  const overall = useMemo(() => sumLines(files), [files]);
  const shown = useMemo(() => sumLines(visible), [visible]);

  const activeLabel =
    FILTERS.find((entry) => entry.value === filter)?.label.toLowerCase() ?? "all";

  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      aria-labelledby="affected-files-heading"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2
            id="affected-files-heading"
            className="text-base font-semibold text-[var(--text)]"
          >
            Affected files
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Files changed by this pull request
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-sm tabular-nums text-[var(--muted)]">
            {plural(files.length, "file")}
          </span>
          <LineStats additions={overall.additions} deletions={overall.deletions} />
        </div>
      </header>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          {FILTERS.map(({ value, label }) => {
            const isActive = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
                  isActive
                    ? "border-[var(--accent-purple)] bg-[var(--elevated)] text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
                )}
              >
                {label}
                <span className="ml-2 tabular-nums opacity-70">
                  {counts[value]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {files.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-sm font-medium text-[var(--text)]">
            No file changes to show
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
            This pull request lists no files, so there is nothing to compare
            here. The rest of the report still applies.
          </p>
        </div>
      ) : (
        <>
          <p role="status" className="px-4 pt-3 text-sm text-[var(--muted)] sm:px-5">
            {filter === "all"
              ? `Showing all ${plural(visible.length, "file")}`
              : `Showing ${visible.length} ${activeLabel} of ${plural(
                  files.length,
                  "file",
                )} \u00b7 +${shown.additions} \u2212${shown.deletions}`}
          </p>

          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center sm:px-5">
              <p className="text-sm font-medium text-[var(--text)]">
                No {activeLabel} files in this pull request
              </p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] transition-colors hover:bg-[var(--elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
              >
                Show all {plural(files.length, "file")}
              </button>
            </div>
          ) : (
            <ul className="mt-2 max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto">
              {visible.map((file) => {
                const { label, color, Icon } = STATUS_META[file.status];
                return (
                  <li
                    key={file.path}
                    className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5"
                  >
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium sm:w-[6.75rem]"
                      style={{
                        color,
                        backgroundColor: tint(color, 14),
                        borderColor: tint(color, 38),
                      }}
                    >
                      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
                      {label}
                    </span>
                    <FilePath path={file.path} />
                    <LineStats
                      additions={file.additions}
                      deletions={file.deletions}
                      className="ml-auto sm:ml-0 sm:w-24 sm:justify-end"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default AffectedFiles;
