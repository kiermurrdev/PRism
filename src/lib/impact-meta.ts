import {
  Circle,
  CircleDot,
  FileDiff,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

import type { ImpactLevel } from "@/types/report";

/**
 * Single source of truth for how each impact level is presented.
 *
 * The graph, node details panel, impact legend, and findings list must all read
 * from here rather than hardcoding strings or colors, so the wording cannot
 * drift apart between components.
 *
 * NOTE: `docs/FRONTEND_SPEC.md` defines a `--status-changed` token, but
 * `ImpactLevel` in `src/types/report.ts` has no `changed` value, so no entry can
 * reference it yet. If a `changed` tier is added to the shared type, add the
 * matching entry here and nothing else needs to change.
 */
export interface ImpactMeta {
  /** User-facing label. Fixed wording — do not paraphrase at call sites. */
  label: string;
  /** CSS custom property name from globals.css. */
  cssVar: string;
  /** One-line explanation, used in the legend and details panel. */
  description: string;
  /** Redundant, non-color encoding of impact, for accessibility. */
  icon: LucideIcon;
}

export const IMPACT_META: Record<ImpactLevel, ImpactMeta> = {
  direct: {
    label: "Directly affected",
    cssVar: "--status-direct",
    description: "Connected to something the diff changed.",
    icon: CircleDot,
  },
  possible: {
    label: "Possibly affected",
    cssVar: "--status-possible",
    description: "May be affected downstream. Unconfirmed.",
    icon: HelpCircle,
  },
  unchanged: {
    label: "Context",
    cssVar: "--status-unchanged",
    description: "Shown for orientation. Believed unaffected.",
    icon: Circle,
  },
};

/** Display order, most to least certain. Use for legends and grouping. */
export const IMPACT_ORDER: readonly ImpactLevel[] = [
  "direct",
  "possible",
  "unchanged",
];

/** Resolves an impact level to a CSS `var()` reference. */
export function impactColor(impact: ImpactLevel): string {
  return `var(${IMPACT_META[impact].cssVar})`;
}

/**
 * The legend must explain all four impact tiers from the frontend
 * specification, including `changed`, which has a `--status-changed` token but
 * no corresponding value in `ImpactLevel`. This display-only union covers the
 * gap without editing the frozen shared type.
 *
 * `IMPACT_META` above stays keyed to the real `ImpactLevel` so the graph cannot
 * accidentally render a tier the data layer cannot produce.
 */
export type DisplayImpactLevel = ImpactLevel | "changed";

export const DISPLAY_IMPACT_META: Record<DisplayImpactLevel, ImpactMeta> = {
  changed: {
    label: "Changed",
    cssVar: "--status-changed",
    description: "Modified directly by the diff.",
    icon: FileDiff,
  },
  ...IMPACT_META,
};

/** Legend display order, most to least certain. */
export const LEGEND_ORDER: readonly DisplayImpactLevel[] = [
  "changed",
  "direct",
  "possible",
  "unchanged",
];
