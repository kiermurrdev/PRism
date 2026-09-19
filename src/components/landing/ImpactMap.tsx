"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAP_EDGES,
  MAP_NODES,
  LEGEND,
  TIER_ORDER,
  DEMO_PR,
  type LandingImpact,
  type MapNode,
} from "@/lib/landing-data";
import { useReducedMotion } from "@/hooks/useLanding";

function buildAdjacency() {
  const adj: Record<string, string[]> = {};
  for (const e of MAP_EDGES) {
    (adj[e.from] ||= []).push(e.to);
  }
  return adj;
}

/** Everything reachable downstream of `id`, exclusive of `id` itself. */
function reachable(adj: Record<string, string[]>, id: string) {
  const seen = new Set<string>();
  const queue = [...(adj[id] ?? [])];
  while (queue.length) {
    const n = queue.shift()!;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of adj[n] ?? []) if (!seen.has(m)) queue.push(m);
  }
  return seen;
}

function tierColor(impact: LandingImpact) {
  return `var(--status-${impact})`;
}

function NodeBox({ node }: { node: MapNode }) {
  const { x, y, w, h, impact, name, tier, detail } = node;
  const cy = y + h / 2;
  const sub =
    impact === "direct" && detail.refs
      ? `${tier} \u00b7 ${detail.refs} ref${detail.refs === 1 ? "" : "s"}`
      : tier;

  return (
    <>
      <rect
        x={x} y={y} width={w} height={h} rx={12}
        fill={impact === "unchanged" ? "var(--surface)" : "var(--surface-elevated)"}
        stroke={impact === "unchanged" ? "var(--border)" : tierColor(impact)}
        strokeWidth={1.5}
      />
      <circle cx={x + 22} cy={cy} r={4.5} fill={tierColor(impact)} />
      <text
        x={x + 38} y={cy - 4}
        fill={impact === "unchanged" ? "var(--text-muted)" : "var(--text-primary)"}
        fontSize={15} fontWeight={600}
      >
        {name}
      </text>
      <text x={x + 38} y={cy + 14} fill={tierColor(impact)} fontSize={11.5}>
        {sub}
      </text>
    </>
  );
}

/**
 * The interactive impact map. Hovering or focusing a component runs a
 * breadth-first walk downstream, dims everything else, lights the
 * reachable subgraph and the edges between, and fills the readout.
 */
export default function ImpactMap() {
  const reduced = useReducedMotion();
  const [draw, setDraw] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  const adj = useMemo(() => buildAdjacency(), []);
  const nodeById = useMemo(
    () => Object.fromEntries(MAP_NODES.map((n) => [n.id, n])),
    []
  );

  const lit = useMemo(() => {
    if (!active) return null;
    const set = reachable(adj, active);
    set.add(active);
    return set;
  }, [active, adj]);

  /* The map draws itself after the hero copy has landed, so the two
     don't compete for attention on load. */
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setDraw(true), 620);
    return () => window.clearTimeout(t);
  }, [reduced]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  /* Hold briefly before clearing. Sweeping the pointer across several
     nodes then reads as one continuous trace instead of flashing the
     empty state between each one. */
  const enter = (id: string) => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = undefined;
    setActive(id);
  };
  const leave = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setActive(null), 110);
  };

  const current = active ? nodeById[active] : null;
  const downstream = active ? reachable(adj, active).size : 0;

  const counts = TIER_ORDER.slice(0, 3).map((impact) => ({
    impact,
    n: MAP_NODES.filter((x) => x.impact === impact).length,
    label: impact === "changed" ? "modified" : impact,
  }));

  return (
    <div className={`map glass rise${draw || reduced ? " draw" : ""}`} data-r="4">
      <div className="map-chrome">
        <div className="map-id">
          <span className="map-pr">
            {DEMO_PR.repo} #{DEMO_PR.number}
          </span>
          <span className="map-title">{DEMO_PR.title}</span>
        </div>
        <div className="map-counts">
          {counts.map((c) => (
            <span className="count" key={c.impact}>
              <span className="dot" style={{ background: tierColor(c.impact) }} />
              <b>{c.n}</b> {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="map-scroll">
        <svg
          className={`map-svg${lit ? " is-tracing" : ""}`}
          viewBox="0 0 1140 336"
          role="group"
          aria-label="Impact map. Hover or focus a component to trace what sits downstream of it."
        >
          <defs>
            <marker
              id="prism-arrow" viewBox="0 0 10 10"
              refX={9} refY={5} markerWidth={5} markerHeight={5}
              orient="auto"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--line-strong)" />
            </marker>
          </defs>

          <g
            className="gx"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={1.4}
            markerEnd="url(#prism-arrow)"
          >
            {MAP_EDGES.map((e) => (
              <path
                key={`${e.from}-${e.to}`}
                d={e.d}
                className={lit && lit.has(e.from) && lit.has(e.to) ? "is-lit" : undefined}
              />
            ))}
          </g>

          {TIER_ORDER.map((tier) => (
            <g className="gn" data-t={tier} key={tier} fontFamily="var(--font-inter), sans-serif">
              {MAP_NODES.filter((n) => n.impact === tier).map((n) => (
                <g
                  key={n.id}
                  className={`gnode${lit?.has(n.id) ? " is-lit" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.name}, ${n.tier}`}
                  onMouseEnter={() => enter(n.id)}
                  onFocus={() => enter(n.id)}
                  onMouseLeave={leave}
                  onBlur={leave}
                >
                  <NodeBox node={n} />
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="map-foot">
        <div className="map-readout">
          <p className={`detail-empty readout-state${current ? "" : " is-on"}`}>
            Hover a component to trace what sits downstream of it.
          </p>
          <div
            className={`detail readout-state${current ? " is-on" : ""}`}
            aria-live="polite"
          >
            <div className="detail-top">
              <span className="detail-name">{current?.name}</span>
              <span
                className="detail-tier"
                style={{ color: current ? tierColor(current.impact) : undefined }}
              >
                {current?.tier}
              </span>
            </div>
            <p className="detail-path">{current?.path}</p>
            <p className="detail-stats">
              {current?.detail.add !== undefined && (
                <span className="add">+{current.detail.add}</span>
              )}
              {current?.detail.del !== undefined && (
                <span className="del">&minus;{current.detail.del}</span>
              )}
              {current?.detail.refs !== undefined && (
                <span>
                  {current.detail.refs} reference
                  {current.detail.refs === 1 ? "" : "s"}
                </span>
              )}
              {current?.detail.note && <span>{current.detail.note}</span>}
              <span>
                {downstream ? `${downstream} downstream` : "nothing downstream"}
              </span>
            </p>
          </div>
        </div>

        <ul className="legend">
          {LEGEND.map((l) => (
            <li key={l.impact}>
              <span className="dot" style={{ background: tierColor(l.impact) }} />
              {l.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
