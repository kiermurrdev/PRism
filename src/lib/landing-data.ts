/**
 * Data for the landing page's impact map and file stack.
 *
 * NOTE ON TYPES: `LandingImpact` below duplicates `DisplayImpactLevel`
 * from `src/lib/impact-meta.ts`. Replace the local union with that
 * import once you have confirmed its exported members — I have not read
 * that file, so I am not guessing at its shape.
 *
 * NOTE ON CONTENT: this is illustrative, not verified against PR #6232.
 * `Mailer`, `Dashboard`, `Auth tests` and the evidence counts are
 * invented. Replace with real pipeline output before the demo.
 */

export type LandingImpact = "changed" | "direct" | "possible" | "unchanged";

export interface MapNodeDetail {
  add?: number;
  del?: number;
  refs?: number;
  note?: string;
}

export interface MapNode {
  id: string;
  name: string;
  tier: string;
  impact: LandingImpact;
  path: string;
  detail: MapNodeDetail;
  /** SVG geometry, in the map's 1140x336 viewBox */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapEdge {
  from: string;
  to: string;
  /** hand-tuned smoothstep path */
  d: string;
}

export const MAP_NODES: MapNode[] = [
  {
    id: "auth",
    name: "Auth controller",
    tier: "Modified",
    impact: "changed",
    path: "lib/plausible_web/controllers/auth_controller.ex",
    detail: { add: 41, del: 6 },
    x: 24, y: 53, w: 200, h: 62,
  },
  {
    id: "rate",
    name: "Rate limiter",
    tier: "Modified",
    impact: "changed",
    path: "lib/plausible/rate_limit.ex",
    detail: { add: 64, del: 0 },
    x: 24, y: 201, w: 200, h: 62,
  },
  {
    id: "reg",
    name: "Registration form",
    tier: "Directly affected",
    impact: "direct",
    path: "lib/plausible_web/live/register_form.ex",
    detail: { refs: 2, note: "not updated" },
    x: 308, y: 25, w: 196, h: 62,
  },
  {
    id: "teams",
    name: "Team invitations",
    tier: "Directly affected",
    impact: "direct",
    path: "lib/plausible/teams/invitations.ex",
    detail: { refs: 1, note: "not updated" },
    x: 308, y: 137, w: 196, h: 62,
  },
  {
    id: "tests",
    name: "Auth tests",
    tier: "Directly affected",
    impact: "direct",
    path: "test/plausible_web/auth_controller_test.exs",
    detail: { refs: 4, note: "not updated" },
    x: 308, y: 249, w: 196, h: 62,
  },
  {
    id: "mailer",
    name: "Mailer",
    tier: "Possibly affected",
    impact: "possible",
    path: "lib/plausible/mailer.ex",
    detail: { note: "no direct reference found \u00b7 model inference" },
    x: 588, y: 137, w: 196, h: 62,
  },
  {
    id: "dash",
    name: "Dashboard",
    tier: "Context",
    impact: "unchanged",
    path: "lib/plausible_web/live/dashboard.ex",
    detail: { note: "believed unaffected" },
    x: 868, y: 137, w: 196, h: 62,
  },
];

export const MAP_EDGES: MapEdge[] = [
  { from: "auth",   to: "reg",    d: "M224 84  C266 84  266 56  308 56" },
  { from: "auth",   to: "teams",  d: "M224 84  C266 84  266 168 308 168" },
  { from: "rate",   to: "teams",  d: "M224 232 C266 232 266 168 308 168" },
  { from: "rate",   to: "tests",  d: "M224 232 C266 232 266 280 308 280" },
  { from: "reg",    to: "mailer", d: "M504 56  C546 56  546 168 588 168" },
  { from: "teams",  to: "mailer", d: "M504 168 H588" },
  { from: "mailer", to: "dash",   d: "M784 168 H868" },
];

/** Draw order for the load animation, outward from the change. */
export const TIER_ORDER: LandingImpact[] = ["changed", "direct", "possible", "unchanged"];

export const LEGEND: { impact: LandingImpact; label: string }[] = [
  { impact: "changed",   label: "Modified" },
  { impact: "direct",    label: "Directly affected" },
  { impact: "possible",  label: "Possibly affected" },
  { impact: "unchanged", label: "Context" },
];

export interface StackFile {
  path: string;
  file: string;
  /** symbol this file defines (for the modified group) */
  sym?: string;
  /** symbol this file references (for the ripple group) */
  refs?: string;
  add?: number;
  del?: number;
  refCount?: number;
}

export const STACK_MODIFIED: StackFile[] = [
  { path: "lib/plausible/", file: "rate_limit.ex", sym: "rate_limit", add: 64, del: 0 },
  { path: "lib/plausible_web/controllers/", file: "auth_controller.ex", sym: "auth_controller", add: 41, del: 6 },
  { path: "lib/plausible_web/plugs/", file: "rate_limit_plug.ex", sym: "rate_limit_plug", add: 18, del: 2 },
];

export const STACK_RIPPLE: StackFile[] = [
  { path: "lib/plausible_web/live/", file: "register_form.ex", refs: "rate_limit_plug", refCount: 2 },
  { path: "lib/plausible/teams/", file: "invitations.ex", refs: "rate_limit", refCount: 1 },
  { path: "test/plausible_web/", file: "auth_controller_test.exs", refs: "auth_controller", refCount: 4 },
];

export const TICKER_WORDS = [
  "the mailer",
  "the auth tests",
  "the invite flow",
  "11 other files",
];

export const DEMO_PR = {
  repo: "plausible/analytics",
  number: 6232,
  title: "Add rate limiting to activation and TOTP endpoints",
  fileCount: 6,
};

export const PR_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+(?:[/?#].*)?$/;
