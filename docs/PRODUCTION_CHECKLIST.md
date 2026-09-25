# PRism Production Checklist

This checklist is for HUMAN operators only. It requires real credentials and access to production systems. Do not run this checklist automatically.

## Pre-Deployment

### Secrets and Credentials
- [ ] Generate `AUTH_SECRET` (at least 32 bytes base64)
- [ ] Generate `ENCRYPTION_MASTER_KEY` (at least 32 bytes hex)
- [ ] Generate `GITHUB_WEBHOOK_SECRET` (at least 32 bytes base64)
- [ ] Obtain GitHub OAuth App credentials (`GITHUB_ID`, `GITHUB_SECRET`)
- [ ] Obtain GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`)
- [ ] Obtain AI provider credentials (`NVIDIA_API_KEY` or equivalent)
- [ ] Obtain Trigger.dev credentials (`TRIGGER_API_KEY`, `TRIGGER_API_URL`)

### Infrastructure
- [ ] PostgreSQL database provisioned and accessible
- [ ] Database user created with appropriate permissions
- [ ] Domain configured with SSL/TLS
- [ ] Load balancer configured (if scaling)
- [ ] Health check endpoint configured (`GET /api/health`)

### GitHub App Configuration
- [ ] GitHub App created with correct permissions:
  - [ ] Pull requests: Read & write
  - [ ] Contents: Read-only
  - [ ] Metadata: Read-only
- [ ] Webhook URL pointing to production `/api/github-webhooks`
- [ ] Webhook secret configured
- [ ] Subscribed events: Pull request, Installation, Installation repositories
- [ ] App installed on target repositories

## Deployment Steps

### 1. Database
```bash
# Create database
psql -U postgres -c "CREATE DATABASE prism;"

# Run migrations
npm run db:migrate

# Verify tables
npm run db:studio
```
- [ ] All tables created successfully
- [ ] No migration errors

### 2. Application
```bash
# Install dependencies
npm ci

# Build
npm run build

# Verify build
npm run lint
npm test
```
- [ ] Build succeeds
- [ ] Lint passes
- [ ] Tests pass

### 3. Start Application
```bash
npm start
```
- [ ] Application starts without errors
- [ ] Health check returns 200: `curl https://your-domain.com/api/health`
- [ ] Health check with DB: `curl https://your-domain.com/api/health?checkDb=true`

### 4. Verify Workers
- [ ] Trigger.dev dashboard shows tasks registered
- [ ] Worker can connect to database
- [ ] Worker can access AI provider

## Post-Deployment Verification

### Manual Tests (Use Real Credentials)

#### 1. GitHub Sign-In
- [ ] Visit `/auth/signin`
- [ ] Complete GitHub OAuth flow
- [ ] User is created in database
- [ ] Session is established

#### 2. GitHub App Installation Linking
- [ ] Visit `/github-install`
- [ ] Install app on a test repository
- [ ] Installation is recorded in database
- [ ] Repositories are visible in dashboard

#### 3. Repository Selection
- [ ] Visit `/dashboard`
- [ ] Select a repository
- [ ] Repository settings page loads

#### 4. BYOK Credential Setup
- [ ] Visit `/dashboard/credentials`
- [ ] Create a new credential with real API key
- [ ] Test credential
- [ ] Credential is stored encrypted

#### 5. Webhook Enqueueing
- [ ] Open a PR in a monitored repository
- [ ] Check logs for webhook receipt
- [ ] Job is created in database
- [ ] Job status changes to "queued"

#### 6. Job Processing
- [ ] Job transitions: queued → ingesting → analyzing → persisting → completed
- [ ] Report is created in database
- [ ] Job completes within expected time

#### 7. PR Comment
- [ ] PR receives comment with report link
- [ ] Comment is recorded in `pr_comments` table
- [ ] Comment link navigates to report

#### 8. Report Viewing
- [ ] Report page loads at `/reports/{id}`
- [ ] Report shows analysis results
- [ ] Report is stable (no re-analysis on refresh)

#### 9. History
- [ ] Dashboard shows job history
- [ ] Past reports are accessible

#### 10. Retry
- [ ] Failed job can be retried from dashboard
- [ ] Retry respects rate limits

## Security Verification

- [ ] No secrets in logs
- [ ] No secrets in browser network tab
- [ ] No secrets in client bundle
- [ ] Rate limiting is active
- [ ] Unauthorized access returns 401/403
- [ ] Webhook signature verification works

## Monitoring Setup

- [ ] Health check alerts configured
- [ ] Error logging configured
- [ ] Job failure alerts configured
- [ ] Database connection monitoring
- [ ] AI provider error monitoring

## Rollback Plan

If deployment fails:

1. Revert to previous commit: `git checkout <previous>`
2. Rebuild: `npm run build`
3. Restart: `npm start`
4. Verify: `curl https://your-domain.com/api/health`

## Ongoing Maintenance

### Daily
- [ ] Check health check endpoint
- [ ] Review error logs
- [ ] Check job failure rate

### Weekly
- [ ] Review security logs
- [ ] Check database size and cleanup old data
- [ ] Review rate limit hits

### Monthly
- [ ] Rotate secrets if needed
- [ ] Review and update dependencies
- [ ] Test rollback procedure

## Notes

- This checklist requires human judgment and real credentials.
- Never commit real credentials to version control.
- Test in staging first before production.
- Keep this checklist updated as the platform evolves.
