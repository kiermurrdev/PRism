# PRism Deployment Guide

This guide covers deploying PRism to production, including prerequisites, configuration, database setup, worker deployment, and rollback procedures.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Domain with SSL/TLS (recommended: Let's Encrypt via Nginx or similar)
- GitHub App configured (see below)
- AI provider credentials (NVIDIA Nemotron or other)
- Trigger.dev account (for background workers)

## Quick Deploy

```bash
# 1. Clone and install
git clone https://github.com/kiermurrdev/PRism.git
cd PRism
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your real values

# 3. Run database migrations
npm run db:migrate

# 4. Build
npm run build

# 5. Start
npm start
```

## Environment Configuration

See `.env.example` for the complete list. Required variables:

### Database
- `DATABASE_URL` — PostgreSQL connection string

### Auth
- `AUTH_SECRET` — Random secret for Auth.js sessions (generate with `openssl rand -base64 32`)
- `GITHUB_ID` — GitHub OAuth App Client ID
- `GITHUB_SECRET` — GitHub OAuth App Client Secret

### Encryption
- `ENCRYPTION_MASTER_KEY` — AES-256 master key for credential vault (generate with `openssl rand -hex 32`)

### GitHub App
- `GITHUB_APP_ID` — Numeric App ID
- `GITHUB_APP_PRIVATE_KEY` — PEM private key (keep as single line with `\n` escaped)
- `GITHUB_WEBHOOK_SECRET` — Random secret (generate with `openssl rand -base64 32`)
- `GITHUB_APP_SLUG` — App URL slug
- `NEXT_PUBLIC_APP_URL` — Public base URL (e.g., `https://prism.yourdomain.com`)

### AI Provider
- `NEMOTRON_BASE_URL` — AI API endpoint
- `NEMOTRON_MODEL` — Model name
- `NVIDIA_API_KEY` — AI provider API key

### Trigger.dev (Workers)
- `TRIGGER_API_KEY` — Trigger.dev API key
- `TRIGGER_API_URL` — Trigger.dev API URL

## GitHub App Setup

1. Create a GitHub App at https://github.com/settings/apps/new
2. Configure:
   - **Homepage URL**: your `NEXT_PUBLIC_APP_URL`
   - **Callback URL**: `<NEXT_PUBLIC_APP_URL>/api/auth/callback/github`
   - **Webhook URL**: `<NEXT_PUBLIC_APP_URL>/api/github-webhooks`
   - **Webhook secret**: store as `GITHUB_WEBHOOK_SECRET`
   - **Enable webhooks**: checked
3. **Permissions**:
   - Pull requests: Read & write
   - Contents: Read-only
   - Metadata: Read-only
4. **Subscribed events**:
   - Pull request
   - Installation
   - Installation repositories
5. Generate and download the **Private key**; store as `GITHUB_APP_PRIVATE_KEY`
6. Record the **App ID** as `GITHUB_APP_ID` and **App slug** as `GITHUB_APP_SLUG`
7. Install the app on target repositories

## Database Setup

### Create Database
```sql
CREATE DATABASE prism;
```

### Run Migrations
```bash
npm run db:migrate
```

### Verify Schema
```bash
npm run db:studio
# Check that all tables are created
```

## Worker Deployment

PRism uses Trigger.dev for background analysis jobs.

### Option 1: Trigger.dev Cloud
1. Create account at https://trigger.dev
2. Create a new project
3. Copy `TRIGGER_API_KEY` and `TRIGGER_API_URL` to `.env`
4. The worker is auto-discovered via `src/lib/jobs/trigger.config.ts`

### Option 2: Self-hosted Trigger.dev
1. Deploy Trigger.dev runtime alongside PRism
2. Configure `TRIGGER_API_URL` to point to your runtime
3. Ensure the runtime can access the same `.env` variables

## Health Checks

- **Basic**: `GET /api/health` — returns `{"status": "ok"}` when running
- **With DB check**: `GET /api/health?checkDb=true` — verifies database connectivity

Configure your load balancer or orchestrator to poll this endpoint.

## Scaling

- **Stateless**: The Next.js app is stateless; run multiple instances behind a load balancer.
- **Database**: Single PostgreSQL instance; consider read replicas for high traffic.
- **Workers**: Trigger.dev handles worker scaling; configure concurrency limits in your Trigger.dev dashboard.

## Monitoring

- Enable structured logging (built-in via `src/lib/logging.ts`)
- Monitor health check endpoint
- Set up alerts for:
  - Failed health checks
  - High job failure rate
  - Database connection errors
  - AI provider errors

## Security Checklist

- [ ] All secrets in environment variables (never in code)
- [ ] HTTPS enabled
- [ ] Database credentials not exposed
- [ ] GitHub App private key secured
- [ ] Rate limiting enabled (built-in)
- [ ] CORS configured for your domain only

## Rollback

If a deployment fails:

1. **Revert code**: `git checkout <previous-commit>`
2. **Rebuild**: `npm run build`
3. **Restart**: `npm start`
4. **Database**: If migrations broke, run `npm run db:migrate` with the previous version

### Database Rollback
Drizzle migrations are forward-only. For rollback:
1. Check migration history in `drizzle` schema tables
2. Manually reverse problematic migrations if needed
3. Or restore from backup

## Feature Flags

Control rollout with environment variables:

- `FEATURE_NEW_JOB_FLOW` — New background job analysis (default: true)
- `FEATURE_NEW_DASHBOARD` — New dashboard UI (default: true)
- `FEATURE_CREDENTIAL_MANAGEMENT` — Credential management (default: true)
- `FEATURE_WEBHOOK_ANALYSIS` — Webhook-driven analysis (default: true)
- `FEATURE_NEW_REPORT_VIEWER` — New report viewer (default: true)

Disable any feature by setting it to `false`.
