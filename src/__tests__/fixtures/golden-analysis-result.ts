import type { AnalysisResult } from "@/types/analysis";

/**
 * Golden fixture for analysis results.
 *
 * This is a sanitized, deterministic AnalysisResult based on a realistic
 * PR analysis. It contains no credentials, no sensitive source content,
 * and no environment-specific values.
 *
 * Used for:
 * - Schema validation tests
 * - Regression tests for the analysis-to-report contract
 * - Verifying React Flow node/edge compatibility
 * - Testing session storage load/save
 */
export const goldenAnalysisResult: AnalysisResult = {
  title: "Add user authentication",
  prUrl: "https://github.com/owner/repo/pull/42",
  summary:
    "This PR introduces a new authentication layer with password hashing and a login page. The changes are primarily contained within the auth module and login UI, with minimal impact on existing components.",
  nodes: [
    {
      id: "auth-module",
      label: "Auth Module",
      kind: "backend",
      impact: "direct",
      description: "New authentication logic with password hashing and verification.",
      reason: "Contains the core authentication functions added by this PR.",
      filePaths: ["src/lib/auth.ts"],
      position: { x: 100, y: 100 },
    },
    {
      id: "login-page",
      label: "Login Page",
      kind: "frontend",
      impact: "direct",
      description: "New login page UI for user authentication.",
      reason: "Directly consumes the auth module to provide login functionality.",
      filePaths: ["src/app/login/page.tsx"],
      position: { x: 300, y: 100 },
    },
    {
      id: "shared-utils",
      label: "Shared Utils",
      kind: "service",
      impact: "possible",
      description: "Shared utility functions that may be affected by auth changes.",
      reason: "Located in the same directory as auth module; may provide helper functions.",
      filePaths: ["src/lib/utils.ts"],
      position: { x: 200, y: 250 },
    },
  ],
  edges: [
    {
      id: "login-to-auth",
      source: "login-page",
      target: "auth-module",
    },
    {
      id: "auth-to-utils",
      source: "auth-module",
      target: "shared-utils",
    },
  ],
  findings: [
    {
      id: "find-1",
      title: "New authentication surface",
      severity: "medium",
      description:
        "This PR introduces a new authentication mechanism. Ensure password hashing uses a strong algorithm and that session management is secure.",
      affectedNodes: ["auth-module", "login-page"],
    },
  ],
  qaItems: [
    {
      id: "qa-1",
      description:
        "Verify that password hashing uses a secure algorithm (e.g., bcrypt, argon2).",
      checked: false,
    },
    {
      id: "qa-2",
      description:
        "Test login flow with valid and invalid credentials.",
      checked: false,
    },
    {
      id: "qa-3",
      description:
        "Ensure login page is accessible via keyboard navigation.",
      checked: false,
    },
  ],
  affectedFiles: [
    {
      path: "src/lib/auth.ts",
      status: "added",
      additions: 45,
      deletions: 0,
      changeType: "New file: authentication module",
    },
    {
      path: "src/app/login/page.tsx",
      status: "added",
      additions: 30,
      deletions: 0,
      changeType: "New file: login page",
    },
  ],
  metadata: {
    source: "live",
    analyzedAt: "2026-01-15T10:30:00.000Z",
    headSha: "abc123def456",
  },
};
