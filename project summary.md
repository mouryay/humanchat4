# HumanChat Project Summary

## Current Focus
- Firebase auth migration is complete end-to-end (frontend session bridge + backend cookie issuance) and powering all sessions.
- Jest open-handle warnings resolved through Redis teardown logic and WebSocket cleanup helpers.
- Cloud Run API now deploys against the new Cloud SQL Postgres instance via Secret Manager–backed env vars; latest revision `humanchat-api-00011-v94` passes `/health` checks.
- Local `.env` matches production secrets to keep migrations/tests aligned while Supabase is being phased out.

## Backend Highlights
- Express-based API with Firebase-authenticated sessions, Redis-backed WebSocket signaling, and Stripe integrations.
- Robust token service reuses refresh sessions when possible and validates payloads with Zod-based error handling.
- Deployment artifacts include a production `Dockerfile`, `.dockerignore`, and Cloud Run deploy script supporting Artifact Registry builds and environment injection.

## Frontend Highlights
- Next.js 16 app under `apps/web` with Firebase session bridging, admin dashboards, and chat UI components.
- Extensive component library (booking flows, chat UI, profile views) plus hooks/services for API interaction.

## Testing & Tooling
- Jest projects split into `client` and `server` suites, run via `npm run test`/`test:api` with `ts-jest` ESM configuration.
- Playwright e2e suite (`npm run test:e2e`) and MSW handlers for API mocking.
- Scripts folder contains deploy helpers, migration runners, and environment verification utilities.

## Infrastructure Roadmap
- Terraform currently provisions Vercel (frontend), Railway (API/ws), Supabase, Upstash Redis, and Cloudflare DNS; Cloud SQL + Cloud Run are being introduced alongside Secret Manager.
- `scripts/deploy-cloud-run.sh` and `docs/environment.md` cover deploying to Cloud Run with `--add-cloudsql-instances` and `--set-secrets` for Firebase + Postgres credentials; manual `gcloud run services update` has been validated.
- Remaining work: encode Cloud SQL, Cloud Run, and Secret Manager resources in Terraform, grant workload identity permissions, and prep DNS cutover toward Google Cloud endpoints once traffic parity is confirmed.

## Next Steps
1. Promote the new Cloud SQL-backed Cloud Run revision by exercising authenticated endpoints, watching logs, and validating migrations.
2. Encode Cloud SQL/Cloud Run/Secret Manager resources plus IAM bindings in Terraform, then remove the legacy Railway + Supabase dependencies when parity is proven.
3. Wire the Cloud Run deploy script into CI/CD (GitHub Actions) using workload identity; add regression tests (health + smoke flows) post-deploy.
4. Update monitoring/alerts (Cloud Logging + uptime checks) and document the DNS cutover plan before routing production traffic away from Railway.
