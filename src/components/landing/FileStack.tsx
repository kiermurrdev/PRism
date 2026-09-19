"use client";

import { useState } from "react";
import {
  DEMO_PR,
  STACK_MODIFIED,
  STACK_RIPPLE,
  type StackFile,
} from "@/lib/landing-data";
import { useReducedMotion, useReveal } from "@/hooks/useLanding";

export default function FileStack() {
  const reduced = useReducedMotion();
  const { ref, inView } = useReveal<HTMLDivElement>();
  const [traced, setTraced] = useState<string | null>(null);

  const isLit = (f: StackFile) =>
    traced !== null && (f.sym === traced || f.refs === traced);

  const row = (f: StackFile, d: number, impact: "changed" | "direct") => (
    <li key={f.path + f.file}>
      <button
        className={`row${isLit(f) ? " is-lit" : ""}`}
        type="button"
        data-d={d}
        onMouseEnter={() => setTraced(f.refs ?? f.sym ?? null)}
        onFocus={() => setTraced(f.refs ?? f.sym ?? null)}
        onMouseLeave={() => setTraced(null)}
        onBlur={() => setTraced(null)}
      >
        <span className="dot" style={{ background: `var(--status-${impact})` }} />
        <span className="path">
          {f.path}
          <em>{f.file}</em>
        </span>
        <span className="meta">
          {f.add !== undefined ? (
            <>
              <span className="add">+{f.add}</span>{" "}
              <span className="del">&minus;{f.del}</span>
            </>
          ) : (
            `${f.refCount} ref${f.refCount === 1 ? "" : "s"}`
          )}
        </span>
      </button>
    </li>
  );

  const cls = [
    "stack",
    "panel",
    reduced ? "" : "seq",
    inView ? "is-ready" : "",
    traced ? "is-tracing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} ref={ref}>
      <div className="stack-bar">
        <p className="stack-repo">
          {DEMO_PR.repo} <span>#{DEMO_PR.number}</span>
        </p>
        <p className="stack-count">{DEMO_PR.fileCount} files changed</p>
      </div>

      <div className="stack-group">
        <p className="stack-label" data-d={1}>
          <b style={{ color: "var(--status-changed)" }}>
            Modified by this pull request
          </b>
          <i>read from the diff</i>
        </p>
        <ul>{STACK_MODIFIED.map((f, i) => row(f, i + 2, "changed"))}</ul>
      </div>

      <div className="boundary" aria-hidden="true">
        <span className="boundary-rule" />
        <span className="boundary-text">below this line, nothing was updated</span>
      </div>

      <div className="stack-group">
        <p className="stack-label" data-d={5}>
          <b style={{ color: "var(--status-direct)" }}>
            References the change, not in the diff
          </b>
          <i>found by search &mdash; hover a row to trace it</i>
        </p>
        <ul>{STACK_RIPPLE.map((f, i) => row(f, i + 6, "direct"))}</ul>
      </div>

      <p className="stack-foot" data-d={9}>
        Each path is checked against the repository tree before it&apos;s shown.
      </p>
    </div>
  );
}
