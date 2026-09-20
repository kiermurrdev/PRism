# PRism Brev Demo Runbook

Concise, repeatable steps for deploying the PRism prototype on a Brev GPU instance for SteelHacks.

This runbook assumes:
- You have a Brev account with available GPU credits.
- You have a GitHub account (for public PR analysis).
- You are working from a terminal with bash (Linux/macOS or Git Bash on Windows).

## 1. Configure the Required Environment

PRism requires these environment variables at runtime. Use placeholder values until you have the actual credentials.

| Variable | Description | Example |
|----------|-------------|---------|
| `NEMOTRON_API_URL` | Nemotron NIM endpoint URL (HTTPS) | `https://nemotron-nim.your-instance.brev.dev/v1` |
| `NEMOTRON_API_KEY` | API key for Nemotron NIM | `sk-your-nemotron-key-here` |
| `GITHUB_TOKEN` | Optional: GitHub personal access token for higher rate limits. Leave unset for public-only access. | `ghp_xxxxx` |

### Set environment variables (Linux/macOS / Git Bash)

```bash
export NEMOTRON_API_URL="https://nemotron-nim.your-instance.brev.dev/v1"
export NEMOTRON_API_KEY="sk-your-nemotron-key-here"
export GITHUB_TOKEN="ghp_xxxxx"  # Optional
```

On Windows PowerShell, use:

```powershell
$env:NEMOTRON_API_URL="https://nemotron-nim.your-instance.brev.dev/v1"
$env:NEMOTRON_API_KEY="sk-your-nemotron-key-here"
$env:GITHUB_TOKEN="ghp_xxxxx"
```

## 2. Start the Nemotron NIM Endpoint

On Brev, launch a Nemotron NIM container (or equivalent LLM inference endpoint).

1. Log in to your Brev console.
2. Launch a GPU instance with a Nemotron NIM image (or your chosen inference container).
3. Configure the instance to expose the API endpoint on port 8000 (or the default port for your container).
4. Once running, note the public URL and API key.

Set these in your environment as shown above.

Verify the endpoint is reachable:

```bash
curl -s -H "Authorization: Bearer $NEMOTRON_API_KEY" "$NEMOTRON_API_URL/models" | head -c 500
```

If you see a JSON response listing models, the endpoint is ready.

## 3. Start PRism

Clone and install the PRism repository:

```bash
git clone https://github.com/kiermurrdev/PRism.git
cd PRism
npm install
```

Start the development server:

```bash
npm run dev
```

The server listens on `http://localhost:3000` by default.

## 4. Expose Only the PRism Web Application

Use your preferred tunneling method to expose `http://localhost:3000` to the internet.

Example with `ngrok`:

```bash
ngrok http 3000
```

Note the public HTTPS URL (e.g., `https://abc123.ngrok.io`). Share this URL for the demo.

**Important:** Only expose PRism's web application. Do not expose the Nemotron NIM endpoint directly to users.

## 5. Call the Health Endpoint

Verify PRism is running and healthy:

```bash
curl -s https://abc123.ngrok.io/api/health | jq .
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-09-19T21:00:00.000Z"
}
```

The health endpoint reports readiness only. It does not expose secrets, tokens, or configuration.

## 6. Run One Public-PR Smoke Test

Test live analysis against a public PR:

```bash
curl -s -X POST https://abc123.ngrok.io/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repo":"vercel/next.js","prNumber":60000}' | jq .
```

A successful response returns a JSON report with:
- `title`, `summary`
- `nodes` and `edges` (impact graph)
- `findings` (risk items)
- `qaItems` (test checklist)
- `affectedFiles`
- `metadata.source: "live"`

If live analysis is unavailable (Nemotron not configured or unreachable), PRism falls back to a fixture-backed example report with `metadata.source: "example"`.

## 7. Stop the Next.js Process

When the demo is complete, stop PRism:

- Press `Ctrl+C` in the terminal where `npm run dev` is running.

## 8. Stop the GPU/Brev Instance

To avoid consuming GPU credits:

1. Log in to your Brev console.
2. Stop and terminate the GPU instance running Nemotron NIM.
3. If using a tunneling service, terminate that process as well.

## Troubleshooting

### PRism fails to connect to Nemotron
- Verify `NEMOTRON_API_URL` and `NEMOTRON_API_KEY` are set correctly.
- Test the endpoint directly with `curl` (Step 2).
- If the endpoint is unreachable, PRism will return a `MISSING_CONFIG` or `UPSTREAM_ERROR` response.

### GitHub rate limit exceeded
- For public PRs, GitHub allows limited unauthenticated requests.
- Set `GITHUB_TOKEN` with a personal access token (public repo read access is sufficient).

### Analysis returns `CONCURRENT_REQUEST`
- Only one analysis runs at a time (prototype limitation).
- Wait a few seconds and retry.

### Health endpoint returns no response
- Ensure PRism is running (`npm run dev`) and the tunnel is active.
- Check that the URL points to port 3000.

### Live analysis unavailable
- If Nemotron is not configured or fails, PRism shows a fixture-backed example report.
- The example workflow still demonstrates the UI and interaction flow.

## Known Prototype Limitations

- **One analysis at a time:** A shared concurrency guard ensures only a single analysis runs simultaneously.
- **In-memory cache only:** Cached results are lost on process restart.
- **No authentication:** The demo has no user authentication or access control.
- **No persistence:** Analysis results are not stored; they exist only in memory.
- **No distributed locking:** The concurrency guard is process-scoped only.
- **Public PRs only (without token):** Private repositories require a valid GitHub token.
- **Prototype readiness only:** Not intended for production use.
