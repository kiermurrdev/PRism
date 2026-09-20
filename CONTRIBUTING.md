# PRism — Analysis Pipeline

## Overview

PRism analyzes GitHub pull requests and generates an interactive impact report. The pipeline runs server-side as a single API call (`POST /api/analyze`) and streams progress as NDJSON.

### High-level flow

1. Client sends `{ repo: "owner/repo", prNumber: 42 }` to `/api/analyze`
2. Server validates request, acquires a one-at-a-time concurrency guard
3. Server streams NDJSON events (`stage`, `complete`, `error`) as work progresses:
   - **Fetching**: ingest PR metadata, changed files, patches, and repo tree from GitHub
   - **Analyzing**: generate a bounded context string from the snapshot
   - **Analyzing**: call Nemotron 7B via NIM to analyze the PR
   - **Generating**: construct the final report with QA checklist
4. Server validates the result against the shared Zod schema
5. Client receives the final `AnalysisResult` and stores it in sessionStorage

## Architecture

### Modules

| Module | Responsibility |
|--------|---------------|
| `src/lib/github` | GitHub API client: fetch PR, files, patches, repo tree |
| `src/lib/analysis/context` | Generate a bounded context string from the PR snapshot |
| `src/lib/nemotron` | Call Nemotron 7B via NIM with the analysis prompt |
| `src/lib/analysis/schema.ts` | Shared Zod schemas for request, result, and progress |
| `src/app/api/analyze/route.ts` | Pipeline orchestrator with concurrency guard |

### Data flow

```
POST /api/analyze
  -> ingestPR() -> PRSnapshot
  -> generateContext() -> context string
  -> analyzeWithNemotron() -> Report
  -> AnalysisResultSchema.validate() -> AnalysisResult
  -> NDJSON stream to client
```

### Key constraints

- **Determinism**: `generateContext()` is pure — same input always produces same output.
- **Bounded context**: context generation enforces per-section and total character limits (60KB max) to stay within model context windows.
- **One-at-a-time guard**: only one analysis runs per repo+PR+headSha at a time.
- **Streaming**: progress events let the client show real-time status without polling.

## Nemotron Configuration

### Required environment variables

| Variable | Description |
|----------|-------------|
| `NIM_ENDPOINT` | Full URL of the Nemotron 7B NIM endpoint (e.g., `https://.../v1/chat/completions`) |
| `NIM_API_KEY` | API key for the NIM endpoint |

### Runtime config

The Nemotron client uses fixed parameters defined in `src/lib/nemotron/constants.ts`:

- **Temperature**: 0.2 (low for deterministic analysis)
- **Max tokens**: 4096
- **Timeout**: 120 seconds
- **Model**: Nemotron 7B (via NIM)

The prompt template in `src/lib/nemotron/prompt.ts` instructs the model to:
1. Analyze the PR changes and their downstream impact
2. Identify affected components and their relationships
3. Generate findings with severity levels (info, warning, high)
4. Create a QA checklist
5. Output a strict JSON structure matching the `AnalysisResult` schema

## Testing

### Test structure

All tests live under `src/__tests__/` and use Node's built-in test runner:

| Test file | Coverage |
|-----------|----------|
| `context-generator.test.ts` | Context generation, truncation, exclusions |
| `github-ingestion.test.ts` | GitHub API client, URL parsing, error handling |
| `github-url.test.ts` | URL validation utilities |
| `nemotron-client.test.ts` | Nemotron client, prompt building, response parsing |
| `analyze-route.test.ts` | Full pipeline integration tests |
| `analysis-schema.test.ts` | Schema validation with golden fixture |
| `react-flow-compatibility.test.ts` | Node/edge ID consistency for the graph |
| `ndjson-events.test.ts` | NDJSON serialization for streaming |

### Fixtures

- `src/__tests__/fixtures/context-fixtures.ts` — PR snapshots for context tests
- `src/__tests__/fixtures/golden-analysis-result.ts` — Sanitized golden AnalysisResult

## Commands

Run all commands from the project root (`C:\Users\kiera\dc\PRism`).

### Development

```bash
npm run dev          # Start Next.js dev server (hot reload)
```

### Quality checks

```bash
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
npm test             # Run all tests (Node test runner)
npm run build        # Production build
```

### Test with coverage (if configured)

```bash
c8 npm test          # Run tests with coverage report
```

## Contributing guidelines

1. **Run checks before committing**: `npm run lint && npm run type-check && npm test`
2. **Keep context generation pure**: no side effects in `generateContext()`
3. **Update fixtures when schemas change**: golden fixture must always validate
4. **Test edge cases**: truncated PRs, missing patches, deleted files, large repos
5. **Preserve determinism**: tests rely on identical input → identical output
