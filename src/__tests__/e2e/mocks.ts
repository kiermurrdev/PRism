/**
 * E2E test infrastructure: mocks for external services.
 *
 * Provides mock implementations of:
 * - GitHub API (PRs, files, comments, installations)
 * - AI provider (Nemotron)
 * - Database operations
 *
 * Used by e2e tests to verify the full workflow without real credentials.
 */

import type { AnalysisJobPayload } from "@/lib/jobs/queue";
import type { NewReport } from "@/lib/db/schema";

/**
 * Mock GitHub PR data.
 */
export const MOCK_PR = {
  number: 42,
  title: "Add new feature",
  headBranch: "feature-branch",
  baseBranch: "main",
  headSha: "abc123def456",
  url: "https://github.com/test-org/test-repo/pull/42",
};

/**
 * Mock GitHub file changes.
 */
export const MOCK_CHANGED_FILES = [
  {
    filename: "src/lib/core.ts",
    status: "modified" as const,
    additions: 50,
    deletions: 10,
    patch: "@@ -1,5 +1,55 @@\n+import { newFeature } from './feature';\n module.exports = { /* ... */ };",
  },
  {
    filename: "src/lib/feature.ts",
    status: "added" as const,
    additions: 100,
    deletions: 0,
    patch: "@@ -0,0 +1,100 @@\n+export function newFeature() { /* ... */ }",
  },
];

/**
 * Mock installation data.
 */
export const MOCK_INSTALLATION = {
  githubInstallationId: 12345,
  accountId: "test-account-id",
  appId: 999,
  appSlug: "prism-test",
};

/**
 * Mock repository data.
 */
export const MOCK_REPOSITORY = {
  id: "test-repo-id",
  githubRepoId: 54321,
  fullName: "test-org/test-repo",
  installationId: "test-installation-id",
  isPrivate: false,
};

/**
 * Mock analysis job payload.
 */
export function createMockJobPayload(overrides?: Partial<AnalysisJobPayload>): AnalysisJobPayload {
  return {
    repositoryId: MOCK_REPOSITORY.id,
    prNumber: MOCK_PR.number,
    headSha: MOCK_PR.headSha,
    action: "opened",
    installationId: MOCK_INSTALLATION.githubInstallationId,
    credentialId: null,
    promptVersion: "v1",
    autoComment: true,
    ...overrides,
  };
}

/**
 * Mock report data.
 */
export const MOCK_REPORT: NewReport = {
  jobId: "test-job-id",
  repositoryId: MOCK_REPOSITORY.id,
  userId: "test-user-id",
  headSha: MOCK_PR.headSha,
  provider: "nvidia",
  model: "nvidia/nemotron-test",
  promptVersion: "v1",
  title: `Analysis: ${MOCK_PR.title}`,
  prUrl: MOCK_PR.url,
  summary: "This PR introduces a new feature with minimal architectural impact.",
  nodes: [
    { id: "module-a", label: "Module A", type: "module" },
    { id: "feature", label: "New Feature", type: "module" },
  ],
  edges: [
    { id: "e1", source: "feature", target: "module-a", label: "depends on" },
  ],
  findings: [
    {
      impact: "low",
      description: "New feature is well-isolated.",
      affectedModules: ["New Feature"],
    },
  ],
  qaItems: [
    { question: "Are there integration tests?", priority: "medium" },
  ],
  affectedFiles: [
    { path: "src/lib/core.ts", changes: "modified", impact: "low" },
    { path: "src/lib/feature.ts", changes: "added", impact: "low" },
  ],
  schemaVersion: "v1",
};

/**
 * Mock GitHub API response for PR fetch.
 */
export function mockFetchPRForInstallation(): { ok: true; data: { title: string; baseBranch: string; headBranch: string } } {
  return {
    ok: true,
    data: {
      title: MOCK_PR.title,
      baseBranch: MOCK_PR.baseBranch,
      headBranch: MOCK_PR.headBranch,
    },
  };
}

/**
 * Mock GitHub API response for changed files fetch.
 */
export function mockFetchChangedFilesForInstallation(): { ok: true; files: typeof MOCK_CHANGED_FILES } {
  return {
    ok: true,
    files: MOCK_CHANGED_FILES,
  };
}

/**
 * Mock Nemotron adapter response.
 */
export function mockNemotronAnalyze() {
  return {
    ok: true as const,
    report: {
      title: MOCK_REPORT.title,
      summary: MOCK_REPORT.summary,
      nodes: MOCK_REPORT.nodes,
      edges: MOCK_REPORT.edges,
      findings: MOCK_REPORT.findings,
      qaItems: MOCK_REPORT.qaItems,
      affectedFiles: MOCK_REPORT.affectedFiles,
    },
  };
}

/**
 * Mock GitHub comment publish response.
 */
export function mockPublishPrComment() {
  return {
    ok: true as const,
    action: "created" as const,
    commentId: 987654,
  };
}

/**
 * Mock correlation ID generator.
 */
export function mockGenerateCorrelationId(): string {
  return "test-correlation-id-" + Math.random().toString(36).slice(2, 8);
}
