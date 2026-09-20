# PRism — Architectural Impact Analysis for Pull Requests

PRism is a GitHub App that automatically analyzes pull requests and posts architectural impact reports directly on the PR. It uses NVIDIA Nemotron to evaluate code changes, identify affected modules, and highlight potential risks.

## Quick Start

```bash
git clone https://github.com/kiermurrdev/PRism.git
cd PRism
npm install
cp .env.example .env
# Edit .env with your configuration (see below)
npm run dev
```

Open http://localhost:3000 to see the app.

## Configuration

Copy `.env.example` to `.env` and fill in the required values:

### GitHub App (required for webhook-driven analysis)

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | Numeric ID from your GitHub App settings |
| `GITHUB_APP_PRIVATE_KEY` | PEM-encoded private key (downloaded when creating the app) |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for webhook signature verification |
| `GITHUB_APP_SLUG` | Your app's URL slug (e.g., `prism-review`) |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g., `https://prism.yourdomain.com`) |

### Nemotron AI Backend (required for analysis)

| Variable | Description |
|----------|-------------|
| `NEMOTRON_BASE_URL` | NVIDIA Nemotron API endpoint |
| `NEMOTRON_MODEL` | Model name (e.g., `nvidia/nemotron-4-340b-instruct`) |
| `NVIDIA_API_KEY` | Your NVIDIA API key (optional; some endpoints are open) |
| `NEMOTRON_TIMEOUT_MS` | Request timeout in ms (default: 240000, must be below platform limits) |

### Direct GitHub Access (optional, for manual PR ingestion)

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Personal access token with repo scope |

See `.env.example` for the complete list. **Never commit real `.env` files.**

## NVIDIA / Nemotron Setup

1. Create an account at https://build.nvidia.com/
2. Obtain an API key from your profile.
3. Set `NVIDIA_API_KEY` in your `.env`.
4. Configure `NEMOTRON_BASE_URL` to the Nemotron inference endpoint (e.g., `https://ai.api.nvidia.com/v1/chat/completions`).
5. Set `NEMOTRON_MODEL` to the desired model name.

## GitHub App Setup

Full details are in [docs/github-app.md](docs/github-app.md).

### Create the App

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **App name**: e.g., "PRism"
   - **Homepage URL**: your `NEXT_PUBLIC_APP_URL`
   - **Callback URL**: `<NEXT_PUBLIC_APP_URL>/github-install`
   - **Webhook URL**: `<NEXT_PUBLIC_APP_URL>/api/github-webhooks`
   - **Webhook secret**: generate a strong random string; store it as `GITHUB_WEBHOOK_SECRET`
   - **Enable webhooks**: checked
3. **Permissions**:
   - Pull requests: Read & write
   - Contents: Read-only
4. **Subscribed events**:
   - Pull request
5. Generate and download the **Private key**; store it as `GITHUB_APP_PRIVATE_KEY`.
6. Record the **App ID** as `GITHUB_APP_ID` and the **App slug** as `GITHUB_APP_SLUG`.
7. Install the app on your target repositories.

### Callback URL Format

GitHub redirects users here after installation:

```
<NEXT_PUBLIC_APP_URL>/github-install?setup_action=installed&installation_id=12345678
```

PRism validates and displays a confirmation page.

### Webhook URL Format

GitHub sends `pull_request` events to:

```
<NEXT_PUBLIC_APP_URL>/api/github-webhooks
```

PRism verifies the HMAC-SHA256 signature, normalizes the event, and triggers analysis.

## Deployment

### Vercel (recommended)

1. Connect your GitHub repo to Vercel.
2. Add all environment variables from `.env.example` in your Vercel project settings.
3. Deploy.
4. Update your GitHub App's webhook URL and callback URL to use the Vercel production URL.

### Other platforms

Any platform that supports Next.js API routes and can receive webhooks:

1. Build: `npm run build`
2. Start: `npm start`
3. Ensure the platform exposes your API routes publicly.
4. Configure GitHub App URLs to point to your deployed domain.

## Live Verification

After deployment:

1. Open a pull request on a repository where PRism is installed.
2. Within a minute, check for a PRism comment on the PR.
3. Click the analysis link — it should open the interactive report.
4. Push a new commit to the same PR; the existing comment should update in-place (no duplicates).
5. Verify the report export works from the web UI.

## Rollback / Disable

To disable PRism without deleting it:

1. In GitHub App settings, disable the webhook.
2. Or uninstall the app from the target repositories.
3. To fully remove: delete the app at https://github.com/settings/apps.

To rollback a deployment:

1. Revert to the previous commit on your hosting platform.
2. The GitHub App configuration remains unchanged.

## Development

```bash
npm run dev        # Start dev server
npm test           # Run all tests
npm run lint       # Lint TypeScript/JSX
npx tsc --noEmit   # Type check
npm run build      # Production build
```

## Architecture

- Next.js 16 (App Router)
- GitHub App integration with HMAC-verified webhooks
- NVIDIA Nemotron for architectural analysis
- Idempotent PR comments with SHA-based update logic

See [docs/github-app.md](docs/github-app.md) for the complete webhook and authentication contract.

## License

MIT
