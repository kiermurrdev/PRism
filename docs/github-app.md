# GitHub App Integration Contract

This document defines the complete contract for the PRism GitHub App.
Follow it when creating the app in GitHub and implementing the webhook handler.

## Environment Variables

All configuration is loaded from environment variables. Placeholders only; no real secrets here.

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_APP_ID` | Yes | Numeric ID assigned by GitHub when the app is created. |
| `GITHUB_APP_PRIVATE_KEY` | Yes | PEM-encoded private key generated during app creation. |
| `GITHUB_WEBHOOK_SECRET` | Yes | Shared secret used to verify webhook signatures (HMAC-SHA256). |
| `GITHUB_APP_SLUG` | Yes | The app's URL-safe slug (e.g., `prism-review`). |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL of the PRism web app (e.g., `https://prism.example.com`). |

These variables are exposed via the typed configuration layer in `src/lib/github/app/config.ts`.
Missing or invalid values produce a `GitHubAppConfigError` with a sanitized message.

## Installation Flow

1. Developer creates a GitHub App at https://github.com/settings/apps/new.
2. Sets the following:
   - **Homepage URL**: value of `NEXT_PUBLIC_APP_URL`.
   - **Webhook URL**: `<NEXT_PUBLIC_APP_URL>/api/github/webhook`.
   - **Webhook secret**: stored in `GITHUB_WEBHOOK_SECRET`.
   - **Allow auto-installation**: enabled.
3. Sets repository permissions (see below).
4. Subscribes to events (see below).
5. Downloads the private key and stores it as `GITHUB_APP_PRIVATE_KEY`.
6. Records the app ID as `GITHUB_APP_ID` and app slug as `GITHUB_APP_SLUG`.
7. Installs the app on one or more repositories.

### Selected-Repository Behavior

- The app may be installed on a subset of repositories in an organization or account.
- PRism only processes events from repositories where the app is installed.
- The installation ID and repository ID are extracted from each webhook event payload.
- No global or cross-repository access is assumed or required.

## Webhook Flow

### Endpoint

- **URL**: `<NEXT_PUBLIC_APP_URL>/api/github/webhook`
- **Method**: POST
- **Content-Type**: application/json
- **Signature header**: `X-Hub-Signature-256`

### Verification

- The webhook payload is signed with HMAC-SHA256 using `GITHUB_WEBHOOK_SECRET`.
- The signature is read from `X-Hub-Signature-256`.
- If the signature is missing or invalid, the handler returns 401 without processing.

### Subscribed Events

The app subscribes to:

- `pull_request`

Accepted actions for `pull_request`:

- `opened`
- `reopened`
- `synchronize`

All other event types and actions are ignored (200 OK, no processing).

### Processing

On an accepted `pull_request` event:

1. Validate the webhook signature.
2. Extract `installation.id`, `repository.full_name`, and `pull_request.number`.
3. Generate a JWT using `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`.
4. Exchange the JWT for an installation access token scoped to the installation.
5. Fetch the PR metadata and diff via the GitHub API.
6. Run the analysis pipeline (Nemotron LLM).
7. Post a comment on the PR with the analysis summary and a link to the full report.

## Pull-Request Comment Flow

### Comment Marker Format

Each PR comment posted by the app contains a deterministic marker block that identifies it as machine-generated and allows idempotent updates.

```
<!-- PRISM_ANALYSIS_START:repo={repo}:pr={prNumber}:sha={headSha} -->
...analysis content...
<!-- PRISM_ANALYSIS_END -->
```

Where:

- `{repo}` is the full repository name (`owner/repo`).
- `{prNumber}` is the pull request number.
- `{headSha}` is the current head commit SHA of the PR.

### Idempotent Update Behavior

When a new analysis runs for the same PR (e.g., on `synchronize`):

1. List existing comments on the PR.
2. Search for a comment containing a marker with matching `repo` and `pr`.
3. If found:
   - If `sha` matches the current head SHA, do nothing (no-op).
   - If `sha` differs, replace the entire comment body with the new analysis and updated marker.
4. If not found:
   - Create a new comment with the analysis and marker.

This ensures:

- Exactly one PRism comment per PR at any time.
- Updates happen in-place instead of accumulating duplicate comments.
- Re-analyzing the same head SHA is a no-op.

## Deterministic Analysis Link

The analysis link is a stable, deterministic URL that encodes the PR identity:

```
<NEXT_PUBLIC_APP_URL>/analyze?repo={repo}&pr={prNumber}&sha={headSha}
```

Where:

- `{repo}` is URL-safe (already in `owner/repo` form).
- `{prNumber}` is the integer PR number.
- `{headSha}` is the head commit SHA.

This link:

- Is included in every PR comment posted by the app.
- Allows users to view the full interactive report on the PRism web app.
- Can be re-visited to re-render the same analysis (if cached) or re-run it.

## Security Boundaries

- The app uses short-lived installation access tokens (max 1 hour).
- Tokens are never stored persistently or exposed in logs or client-side code.
- The webhook secret is used only for signature verification.
- The private key is server-side only and never sent to the browser.
- All external calls (GitHub API, Nemotron) use server-side credentials.
- Sanitized error messages are returned to clients; internal details are logged only.
- No user authentication is required at MVP; the app operates on repository-level permissions.

## MVP Limitations

- No support for private repositories beyond what the installed app's permissions allow.
- No user-level authentication or OAuth flow.
- No editable or interactive features from within the PR comment.
- No rate-limit backoff beyond basic retries.
- No multi-language support in comments.
- No deletion or archival of analysis data.
