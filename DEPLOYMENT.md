# Deployment Guide

This doc complements `docs/environment.md`, `docs/monitoring.md`, and the Terraform under `infra/`.

## Environments
- **Staging**: `staging.humanchat.com`, `api-staging.humanchat.com`, `ws-staging.humanchat.com`
- **Production**: `humanchat.com`, `api.humanchat.com`, `ws.humanchat.com`

## Environment Variables
See `docs/environment.md` for full list. Key provider-specific secrets:
- `VERCEL_TOKEN`, `VERCEL_TEAM`
- `RAILWAY_TOKEN`
- `SUPABASE_TOKEN`
- `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONE_ID`
- `UPSTASH_EMAIL`, `UPSTASH_API_KEY`

## CI/CD Pipeline
1. GitHub Actions workflow (to add) runs:
   - Install deps → lint/tests (`npm run test` + `npm run test:api`).
   - Upload coverage.
2. On `main` success:
   - `scripts/deploy-web.sh` → Vercel production deploy.
   - `scripts/deploy-api.sh` + `scripts/deploy-ws.sh` → Railway services.
   - `scripts/migrate.sh` invoked via Railway command to run DB migrations.
3. Notify Slack channel once health checks pass.

## Terraform Workflow
```bash
cd infra
terraform init
terraform workspace select staging # or production
terraform plan -var-file=env/staging.tfvars
terraform apply -var-file=env/staging.tfvars
```
Variables file should contain provider tokens and environment-specific URLs. Outputs provide domain + connection strings.

## Manual Deployment (fallback)
```bash
./scripts/verify-env.sh
./scripts/deploy-web.sh
SERVICE_NAME=api ./scripts/deploy-api.sh
SERVICE_NAME=ws ./scripts/deploy-ws.sh
```

## Rollback Procedures
- **Frontend**: `vercel rollback --to <deployment-id>` or select previous build in dashboard.
- **API/WS**: `railway deployments` → `railway rollback --service api <deployment-id>`.
- **Database**: Restore from latest Supabase snapshot (see `docs/backup-restore.md`). Update `DATABASE_URL` secrets, redeploy API.
- **Feature flags**: Toggle via config service (future) or env vars.

## Post-Deploy Verification
1. `curl https://api.humanchat.com/health` returns 200.
2. WebSocket handshake via `wscat -c wss://ws.humanchat.com?token=<jwt>`.
3. Trigger sample booking via staging UI.
4. Ensure Sentry receives deploy marker and no new blocking errors.

## Observability Hooks
- `scripts/deploy-*.sh` should emit logs to CI.
- Better Uptime monitors automatically pause/resume via API (todo).

## Pending Improvements
- Add GitHub Actions workflow file.
- Blue/green deploy for API to avoid downtime during migrations.
- Automated Lighthouse + load testing gates.
