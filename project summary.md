# HumanChat Project Summary

## Current Focus
- Completed migration from Supabase auth to Firebase auth, including frontend session bridges and backend cookie issuance updates.
- Eliminated Jest open-handle warnings by adding Redis teardown logic and WebSocket cleanup helpers.
- Planning infrastructure transition from Railway-hosted API/WebSocket services to Google Cloud Run while retaining Supabase (Postgres) and Upstash Redis.

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
- Terraform currently provisions Vercel (frontend), Railway (API/ws), Supabase, Upstash, and Cloudflare DNS.
- A dedicated `infra/google-cloud/README.md` plus `scripts/deploy-cloud-run.sh` describe the target Cloud Run setup (Artifact Registry builds, env/secrets, autoscaling).
- Pending confirmations: GCP project/region, Artifact Registry repo, Cloud Run service layout, service accounts/Secret Manager usage, and DNS cutover steps.

## Next Steps
1. Gather the remaining GCP configuration details (project ID, region, secrets strategy, service account roles).
2. Update Terraform to add Google provider resources, Cloud Run modules, and revised DNS targets.
3. Integrate Cloud Run deploy script into CI/CD (GitHub Actions) with workload identity, then cut traffic over from Railway once verified.
