# PRism Product Architecture

This document defines the architecture for the persistent, multi-tenant PR review platform that replaces the hackathon prototype. All subsequent implementation work must conform to this architecture.

## 1. Goals and Principles

### Goals

- Support multiple users and teams analyzing pull requests across their own repositories.
- Store analysis reports persistently so they can be revisited without re-running analysis.
- Allow users to supply their own AI provider credentials (NVIDIA, OpenAI, Anthropic, etc.) encrypted server-side.
- Run long-running analysis jobs reliably even when they exceed Vercel function limits.
- Produce stable, shareable report URLs that encode the PR and analysis identity.
- Post PR comments only after a validated report exists in persistent storage.

### Principles

- Provider-neutral: no hardcoded Nemotron. AI access is abstracted behind an adapter interface.
- Server-only secrets: credentials, tokens, and keys never reach the browser.
- Idempotent by design: re-running the same analysis for the same PR/SHA is a no-op.
- View is passive: opening a report never triggers or refreshes analysis.
- Single source of truth: a PostgreSQL database owns all domain data.

## 2. High-Level Architecture

### Component Diagram

```
+----------------+       +------------------+       +------------------+
|   Web App      |       |   API Layer      |       |   Worker Layer   |
|   (Next.js)    |<----->|   (Next.js API)  |<----->|   (Trigger.dev)  |
|                |       |                  |       |                  |
| - Auth pages   |       | - Auth endpoints |       | - Ingestion job  |
| - Report view  |       | - Webhook recv   |       | - Analysis job   |
| - Settings     |       | - Report fetch   |       | - Comment job    |
+-------+--------+       +--------+---------+       +--------+---------+
        |                        |                          |
        |                        |                          |
        v                        v                          v
+-------+------------------------+--------------------------+-------+
|                   PostgreSQL + Drizzle ORM                |
|                                                           |
|  users | accounts | installations | repositories          |
|  provider_credentials | repository_settings               |
|  analysis_jobs | reports | pr_comments                    |
+-----------------------------------------------------------+
                          |
                          v
              +-----------+-----------+
              |  AI Provider Adapters |
              |  (NVIDIA, OpenAI,     |
              |   Anthropic, etc.)    |
              +-----------------------+
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| Web App | Authentication, report rendering, user settings, GitHub installation flow |
| API Layer | Auth endpoints, webhook receiver, report retrieval, settings CRUD |
| Worker Layer | Durable jobs: PR ingestion, AI analysis, report persistence, PR comment posting |
| Database | Persistent storage for all domain entities |
| AI Adapters | Provider-agnostic interface for AI analysis calls |

## 3. Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Database | PostgreSQL | Mature, reliable, supports JSONB, encryption-friendly |
| ORM | Drizzle ORM | Type-safe, lightweight, excellent TypeScript support |
| Auth | Auth.js (NextAuth) v5 | GitHub OAuth support, extensible, standard session model |
| Encryption | AES-256-GCM with key versioning | Server-only credential vault; rotates without re-encrypting all data |
| Worker | Trigger.dev (behind internal interface) | Handles long-running jobs, retries, and Vercel edge compatibility |
| AI Adapters | Custom interface | Provider-neutral; swap providers without changing core logic |

## 4. Domain Model

All entities are versioned; each table includes `created_at` and `updated_at` timestamps.

### 4.1 User

A person who has authenticated with PRism.

```ts
interface User {
  id: string;              // UUID
  email: string;           // Primary contact email
  name?: string;           // Display name
  githubLogin?: string;    // Linked GitHub account
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 Account

A team or organization context. A user can belong to multiple accounts.

```ts
interface Account {
  id: string;              // UUID
  name: string;            // e.g. "Acme Corp"
  ownerId: string;         // User who created the account
  createdAt: Date;
  updatedAt: Date;
}

interface AccountMembership {
  id: string;              // UUID
  accountId: string;
  userId: string;
  role: "owner" | "member";
  createdAt: Date;
}
```

### 4.3 GitHub App Installation

A GitHub App installation that PRism manages on behalf of an account.

```ts
interface Installation {
  id: string;              // UUID
  githubInstallationId: number;  // GitHub's installation ID
  accountId: string;
  appId: number;           // GitHub App ID
  appSlug: string;         // e.g. "prism-review"
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.4 Repository

A GitHub repository where PRism is installed and can analyze PRs.

```ts
interface Repository {
  id: string;              // UUID
  githubRepoId: number;    // GitHub's repository ID
  fullName: string;        // e.g. "owner/repo"
  installationId: string;  // Links to Installation
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.5 Provider Credential

An encrypted AI provider credential supplied by a user for use in analysis.

```ts
interface ProviderCredential {
  id: string;              // UUID
  userId: string;          // Who owns this credential
  provider: string;        // e.g. "nvidia", "openai", "anthropic"
  model: string;           // e.g. "nemotron-4-340b-instruct"
  encryptedApiKey: string; // AES-256-GCM encrypted
  keyVersion: number;      // Encryption key version used
  label?: string;          // User-friendly label
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.6 Repository Settings

Per-repository configuration for analysis behavior.

```ts
interface RepositorySettings {
  id: string;              // UUID
  repositoryId: string;
  credentialId: string;    // Which credential to use for analysis
  promptVersion: string;   // Prompt/schema version for reproducibility
  autoComment: boolean;    // Whether to post PR comments automatically
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.7 Analysis Job

A durable job that tracks the lifecycle of a single analysis run.

```ts
interface AnalysisJob {
  id: string;              // UUID
  repositoryId: string;
  prNumber: number;
  headSha: string;         // The analyzed commit SHA
  credentialId: string;    // Credential used
  promptVersion: string;   // Prompt version used
  status: JobStatus;       // See state machine below
  attemptCount: number;    // Retry count
  errorMessage?: string;   // Last error, if failed
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

type JobStatus =
  | "queued"
  | "ingesting"
  | "analyzing"
  | "persisting"
  | "commenting"
  | "completed"
  | "failed";
```

### 4.8 Report

The persisted output of a successful analysis.

```ts
interface Report {
  id: string;              // UUID
  jobId: string;           // Links to the analysis job
  title: string;
  prUrl: string;
  summary: string;
  nodes: ReportNode[];     // Impact graph nodes
  edges: ReportEdge[];     // Impact graph edges
  findings: ImpactFinding[];
  qaItems: QAItem[];
  affectedFiles: AffectedFile[];
  schemaVersion: string;   // Report schema version for migrations
  analyzedAt: Date;
}
```

The `ReportNode`, `ReportEdge`, `ImpactFinding`, `QAItem`, and `AffectedFile` types are reused from `src/types/report.ts`.

### 4.9 PR Comment State

Tracks the state of the PRism comment on a PR.

```ts
interface PrComment {
  id: string;              // UUID
  repositoryId: string;
  prNumber: number;
  reportId: string;        // Report this comment references
  githubCommentId?: number; // GitHub's comment ID, once created
  headSha: string;         // SHA at time of comment
  status: "pending" | "posted" | "updated" | "failed";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 5. State Machine

### Analysis Job Lifecycle

```
queued -> ingesting -> analyzing -> persisting -> commenting -> completed
          |             |             |             |
          v             v             v             v
         failed       failed        failed        failed
```

Transitions:

| From | To | Trigger | Notes |
|------|-----|---------|-------|
| queued | ingesting | Worker starts fetching PR data | |
| ingesting | analyzing | PR data fetched successfully | |
| analyzing | persisting | AI analysis complete, report generated | |
| persisting | commenting | Report saved to database | |
| commenting | completed | PR comment posted (or skipped if autoComment=false) | |
| any non-terminal | failed | Error occurred | Terminal state; may be retried |

Terminal states: `completed`, `failed`

Retry behavior: On failure, the job is marked `failed`. A separate retry mechanism (manual or scheduled) can create a new job with the same idempotency key if conditions warrant.

## 6. Idempotency

Analysis is idempotent based on a composite key:

```
(idempotency_key) = (installation_id, repository_id, pr_number, head_sha, credential_id, prompt_version)
```

Rules:

1. Before creating a new analysis job, check if a job with the same idempotency key exists.
2. If a job with the same key exists and is `completed`, return its report.
3. If a job with the same key exists and is in a non-terminal state, return "analysis in progress".
4. If a job with the same key exists and is `failed`, allow a new job to be created (retry).
5. Re-analyzing the same PR with a different credential or prompt version is a distinct analysis.

## 7. View Isolation

**Opening a report never triggers or refreshes analysis.**

- The report view page (`/analyze`) fetches the report by its stable URL parameters.
- If a report exists for the given PR/SHA, it is rendered as-is.
- If no report exists, the page shows "No analysis available" (or a link to trigger one, if configured).
- There is no background fetch or auto-refresh that initiates analysis.

## 8. PR Comment Policy

**No PR comment is created until a validated report is committed to persistent storage.**

Sequence:

1. Webhook receives `pull_request` event.
2. A job is created in `queued` state.
3. Worker ingests PR data, runs analysis, generates report.
4. Report is validated against schema and persisted to database.
5. Only after persistence, the comment job posts the PR comment with a link to the report.

This ensures:

- The comment always links to a real, stored report.
- Clicking the link never triggers analysis; it loads what was computed.
- Failed analyses do not leave stale or misleading comments.

## 9. Authentication and Authorization

### 9.1 User Authentication

- Users authenticate via GitHub OAuth through Auth.js.
- A `User` record is created or updated on first login.
- Sessions are managed by Auth.js standard mechanisms.

### 9.2 Data Ownership

- Users own their credentials (`ProviderCredential`).
- Accounts own installations and repositories.
- Only account members can access repositories and reports in that account.

### 9.3 Private Repository Access

- PRism accesses private repositories via the GitHub App installation access token.
- The token is scoped to the installation and repository.
- Tokens are short-lived and never stored persistently.
- Report access is gated: only users in the owning account can view reports for that repository.

### 9.4 Stable Report URLs

Reports are accessible via:

```
/analyze?repo={repo}&pr={prNumber}&sha={headSha}
```

- `repo` is the full repository name (`owner/repo`).
- The URL is stable and deterministic.
- Access requires authentication and authorization (user must have access to the repository via their account).

## 10. Credential Vault

### 10.1 Encryption

- User-supplied AI credentials are encrypted with AES-256-GCM before storage.
- Encryption keys are stored separately from encrypted data.
- Key versioning is supported: each credential records which key version encrypted it.

### 10.2 Key Management

```ts
interface EncryptionKey {
  id: number;              // Key version
  encryptedKeyMaterial: string; // Encrypted with a master key (env var or KMS)
  active: boolean;
  createdAt: Date;
}
```

- The master key is loaded from environment variables or a KMS (e.g., AWS KMS, GCP KMS).
- On key rotation, a new key version is created; existing credentials remain encrypted with their original key.
- Decryption uses the key version stored on each credential.

### 10.3 Security Boundaries

- Encryption and decryption happen server-side only.
- Credentials are never logged, never sent to the browser.
- AI provider calls use decrypted credentials in memory only.

## 11. AI Provider Adapters

### 11.1 Adapter Interface

All AI providers implement a common interface:

```ts
interface AiProviderAdapter {
  analyze(context: AnalysisContext): Promise<AnalysisResult>;
}

interface AnalysisContext {
  repo: string;
  prNumber: number;
  title: string;
  prUrl: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  changedFiles: ChangedFile[];
  repoContext: string;
}

interface AnalysisResult {
  report: ReportData;
  metadata: {
    provider: string;
    model: string;
    analyzedAt: string;
    headSha: string;
  };
}
```

### 11.2 Provider Registry

```ts
interface ProviderRegistry {
  getAdapter(provider: string, model: string, apiKey: string): AiProviderAdapter;
}
```

- The registry maps provider/model pairs to adapter instances.
- New providers are added by implementing the adapter interface and registering them.
- The existing Nemotron client is wrapped as one adapter.

## 12. Worker Integration

### 12.1 Internal Job Interface

The core application does not depend directly on Trigger.dev. An internal interface abstracts the worker layer:

```ts
interface JobQueue {
  enqueue<T>(job: Job<T>): Promise<string>;
  getJob(jobId: string): Promise<JobStatus>;
}

interface Job<T> {
  type: string;
  payload: T;
  retries?: number;
}
```

### 12.2 Worker Types

| Job Type | Responsibility |
|----------|----------------|
| ingestion | Fetch PR data from GitHub API |
| analysis | Run AI analysis via provider adapter |
| persist | Save validated report to database |
| comment | Post or update PR comment on GitHub |

### 12.3 Trigger.dev Integration

If Trigger.dev is used:

- Each worker type is a Trigger task.
- The internal `JobQueue` interface delegates to Trigger.dev.
- Swapping to another worker system requires only changing the `JobQueue` implementation.

## 13. Database Schema (Drizzle)

### Tables

| Table | Primary Key | Foreign Keys | Unique Constraints |
|-------|-------------|--------------|-------------------|
| users | id | - | email |
| accounts | id | owner_id -> users.id | - |
| account_memberships | id | account_id, user_id | (account_id, user_id) |
| installations | id | account_id | github_installation_id |
| repositories | id | installation_id | github_repo_id |
| provider_credentials | id | user_id | - |
| repository_settings | id | repository_id, credential_id | repository_id |
| analysis_jobs | id | repository_id, credential_id | (repository_id, pr_number, head_sha, credential_id, prompt_version) |
| reports | id | job_id | - |
| pr_comments | id | repository_id, report_id | (repository_id, pr_number) |

## 14. Threat Model

### Assets

- User credentials (AI provider API keys)
- GitHub App private key
- Private repository content
- Analysis reports

### Threats and Mitigations

| Threat | Mitigation |
|--------|------------|
| Credential theft | AES-256-GCM encryption; server-only decryption; key versioning |
| Unauthorized report access | Auth.js authentication; account-based authorization |
| GitHub token exposure | Short-lived installation tokens; never stored; never logged |
| Prompt injection via PR content | System prompt isolation; output schema validation |
| Cross-tenant data leakage | Row-level scoping by account_id and repository_id |
| Database compromise | Encrypted credentials; secrets in env/KMS; minimal data exposure |

### Trust Boundaries

```
[Browser] --HTTPS--> [Next.js App] --internal--> [Worker] --internal--> [PostgreSQL]
                          |                          |
                          v                          v
                    [GitHub API]              [AI Provider APIs]
```

- Browser: untrusted; receives only report data and UI.
- Next.js App: trusted; handles auth, secrets, encryption.
- Worker: trusted; handles long-running jobs.
- PostgreSQL: trusted; stores encrypted credentials and reports.
- External APIs: semi-trusted; calls are authenticated and rate-limited.

## 15. Rollout Plan

### Phase 1: Foundation

- Add PostgreSQL + Drizzle ORM.
- Implement Auth.js GitHub login.
- Create domain tables and migrations.
- Implement credential vault with AES-256-GCM.

### Phase 2: AI Abstraction

- Define `AiProviderAdapter` interface.
- Wrap existing Nemotron client as an adapter.
- Implement provider registry.

### Phase 3: Worker Layer

- Implement internal `JobQueue` interface.
- Integrate Trigger.dev behind the interface.
- Implement ingestion, analysis, persist, and comment workers.

### Phase 4: Multi-Tenant Features

- Implement account management.
- Implement repository settings per account.
- Implement per-repository credential assignment.

### Phase 5: Report Persistence and Stable URLs

- Persist reports to database.
- Implement stable report URLs with auth gating.
- Update `/analyze` page to load from database.

### Phase 6: Migration from Prototype

- Deprecate synchronous `/api/analyze`.
- Migrate webhook flow to use worker jobs.
- Remove session storage report mechanism.
- Remove in-memory analysis guard.

## 16. Migration from Prototype

### Current Prototype Components

| Component | Current State | Migration Path |
|-----------|---------------|----------------|
| `/api/analyze` | Synchronous Nemotron analysis with NDJSON streaming | Deprecate; new analysis triggered via webhook or explicit API that enqueues a job |
| Session storage report | Report stored in browser session | Replace with database-stored reports fetched by ID |
| Nemotron client | Hardcoded NVIDIA/Nemotron calls | Wrap as `NemotronAdapter` implementing `AiProviderAdapter` |
| Webhook comment flow | Comment posted immediately, links to `/analyze` which triggers analysis | Comment posted only after report persisted; link loads stored report |
| In-memory analysis guard | Single-process concurrency guard | Replace with database-level idempotency and job queue |

### Backward Compatibility

- The `/analyze` page URL format is preserved for stability.
- Existing report schema (`ReportData`) is reused; new fields added as optional.
- The Nemotron client is not removed; it is wrapped as a provider adapter.

## 17. Assumptions

- PostgreSQL is available as a managed service (e.g., Neon, Supabase, AWS RDS).
- Auth.js v5 is compatible with Next.js 16 App Router.
- Trigger.dev can be deployed alongside the Next.js application.
- GitHub App installation flow remains unchanged from the prototype.
- Users are responsible for providing their own AI provider credentials.

## 18. Observability

### 18.1 Structured Logging

All server-side operations emit structured JSON logs with:

- `level`: info, warn, error, debug
- `timestamp`: ISO 8601
- `correlationId`: UUID to trace a request across components
- `message`: Human-readable description
- Additional context fields as needed

### 18.2 Correlation IDs

- Every incoming request generates a correlation ID.
- The ID is passed through to workers and database operations.
- Logs are queryable by correlation ID for incident investigation.

### 18.3 Redaction

Logs never contain:

- API keys, tokens, or passwords
- GitHub App private keys
- Repository content or diff text
- User credentials or PII

Sensitive fields are automatically redacted by pattern matching on keys and values.

### 18.4 Job Timing

Analysis jobs log duration for each phase:

- `ingestion_duration_ms`: Time to fetch PR data from GitHub
- `analysis_duration_ms`: Time for AI analysis
- `total_duration_ms`: End-to-end job duration

These metrics support performance monitoring and capacity planning.

### 18.5 Error Classification

Errors are classified for alerting:

- `provider_error`: AI provider API failure (rate limit, timeout, auth)
- `github_error`: GitHub API failure (rate limit, auth, network)
- `database_error`: PostgreSQL connection or query failure
- `validation_error`: Input or schema validation failure
- `internal_error`: Unexpected application error

### 18.6 Health Checks

- `GET /api/health`: Basic liveness check (returns 200 when running)
- `GET /api/health?checkDb=true`: Readiness check including database connectivity

Configure load balancers and orchestrators to poll these endpoints.

## 19. Rate Limiting and Abuse Prevention

### 19.1 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Sign-in | 5 requests | 15 minutes |
| Credential test | 5 requests | 5 minutes |
| Manual job start | 10 requests | 5 minutes |
| Webhook receiver | 100 requests | 1 minute |
| Job retry | 5 requests | 5 minutes |
| Report access | 100 requests | 1 minute |

### 19.2 Implementation

- In-memory sliding window with Redis-compatible key format.
- Returns 429 Too Many Requests with `Retry-After` header.
- Per-user and per-IP enforcement for user-facing endpoints.
- Per-installation enforcement for webhook endpoints.

### 19.3 Abuse Controls

- Failed sign-in attempts are rate limited and logged.
- Credential test failures are rate limited to prevent credential stuffing.
- Webhook signatures are verified; invalid signatures are rejected.
- Unauthenticated access to protected routes returns 401.

## 20. Retention and Deletion

### 20.1 Data Retention

| Entity | Retention | Deletion Trigger |
|--------|-----------|------------------|
| Users | Indefinite | Account deletion request |
| Credentials | Indefinite | User deletion or explicit removal |
| Installations | Indefinite | GitHub uninstallation webhook |
| Repositories | Indefinite | Installation deletion |
| Jobs | Indefinite | User deletion or explicit removal |
| Reports | Indefinite | Job deletion or explicit removal |

### 20.2 Cascade Deletion

- **User deletion**: Removes user's credentials; jobs/reports owned by user's account are anonymized or deleted based on account ownership.
- **Installation deletion**: Removes installation, repositories, jobs, reports, and comments associated with that installation.
- **Credential deletion**: Removes the credential; does not affect existing jobs or reports (they reference the credential id but are self-contained).

### 20.3 Implementation

Soft deletion is used where recovery may be needed:

- `deleted_at` timestamp on affected tables.
- Soft-deleted records are excluded from normal queries.
- Periodic cleanup job can permanently delete old soft-deleted records.

## 21. Feature Flags

Feature flags enable gradual rollout and rollback without redeployment.

### 21.1 Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `FEATURE_NEW_JOB_FLOW` | true | Use durable job-based analysis instead of synchronous |
| `FEATURE_NEW_DASHBOARD` | true | New multi-tenant dashboard UI |
| `FEATURE_CREDENTIAL_MANAGEMENT` | true | BYOK credential management page |
| `FEATURE_WEBHOOK_ANALYSIS` | true | Webhook-triggered analysis jobs |
| `FEATURE_NEW_REPORT_VIEWER` | true | New report viewer with stable URLs |

### 21.2 Configuration

Flags are configured via environment variables:

```
FEATURE_NEW_JOB_FLOW=true
FEATURE_NEW_DASHBOARD=true
FEATURE_CREDENTIAL_MANAGEMENT=true
FEATURE_WEBHOOK_ANALYSIS=true
FEATURE_NEW_REPORT_VIEWER=true
```

Set to `false` to disable a feature. Flags are cached on first load; call `resetFeatureFlags()` to refresh.

### 21.3 Legacy Behavior

When `FEATURE_NEW_JOB_FLOW=false`, the system falls back to the original synchronous analysis flow. This allows rollback without code changes.

## 22. Deferred Items

- Multi-region deployment strategy (out of scope for initial platform).
- Webhook delivery reliability beyond GitHub's retry mechanism.
- Report versioning and diffing across commits (future enhancement).
- Audit logging of credential access and job execution.
