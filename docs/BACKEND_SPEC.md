# PRism Backend Specification

This document defines the backend foundation for PRism's live PR analysis pipeline.
All backend agents must read this before implementing any backend work.

## Architecture

PRism uses a simple shared-demo architecture for the hackathon prototype:

- The frontend is a Next.js application that currently renders a demo report from mock data.
- The backend will run inside the same Next.js app using API routes.
- A single typed contract is shared between:
  - GitHub ingestion (fetching PR diff and metadata)
  - Repository-context generation (building the dependency graph)
  - Nemotron analysis (AI-powered impact assessment)
  - The API route (exposing the analysis endpoint)
  - The existing report UI (rendering the result)

No external services, databases, or background jobs are used in this prototype.

## Request Contract

To trigger a live analysis, the client sends:

```ts
export interface AnalysisRequest {
  repo: string;        // e.g. "owner/repo"
  prNumber: number;    // PR number
}
```

## Response Contract

A successful analysis returns the canonical `ReportData` structure (defined in `src/types/report.ts`) extended with metadata:

```ts
export interface AnalysisResult extends ReportData {
  metadata: {
    source: "live";
    analyzedAt: string;   // ISO timestamp
    headSha: string;      // analyzed commit SHA
  };
}
```

The `ReportData` type is the single source of truth for report shape. Do not create competing report types.

## Intermediate States

While analysis is in progress, the backend may emit snapshots:

```ts
export interface AnalysisSnapshot {
  status: "fetching" | "analyzing" | "generating";
  message: string;
}
```

## Error Contract

Errors returned to the frontend are safe and contain no internal details:

```ts
export interface AnalysisError {
  code: string;
  message: string;
}
```

## Module Boundaries

| Module | Responsibility |
|--------|----------------|
| `src/types/report.ts` | Canonical frontend report types |
| `src/types/analysis.ts` | Backend analysis types (request, result, snapshot, error) |
| `src/lib/analysis/schema.ts` | Zod schemas for runtime validation |
| `src/lib/analysis/constants.ts` | Shared constants (session keys, API paths) |
| `src/data/mock-report.ts` | Mock/example report data |

## Environment Variables

All secrets are server-side only. Placeholders are defined in `.env.example`:

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub API authentication |
| `NEMOTRON_BASE_URL` | Nemotron API base URL |
| `NEMOTRON_MODEL` | Nemotron model name |
| `NVIDIA_API_KEY` | NVIDIA API key for Nemotron |

Never hard-code secrets or expose them to the client.

## Session Storage

Analysis results are passed between pages using a shared session-storage key:

```ts
export const ANALYSIS_RESULT_KEY = "PRISM_ANALYSIS_RESULT";
```

## Prototype Limits and Non-Goals

- No authentication or user accounts.
- No persistence or database.
- No background job queue.
- No multi-tenant isolation.
- UI is not redesigned; backend work must preserve the existing frontend contract.
- This is a one-day hackathon prototype; keep it simple and focused.
