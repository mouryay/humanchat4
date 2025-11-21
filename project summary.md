# HumanChat Project Summary

## Current Focus
- Terraform now provisions the full GCP footprint (custom VPC, Serverless VPC connector, Cloud Run API + WebSocket services, Memorystore Redis) alongside Cloudflare DNS and the Vercel frontend; latest apply reconciled DNS and public invoker bindings.
- Fresh API/WS containers are built through Cloud Build into Artifact Registry and deployed via Terraform; WebSocket revision `humanchat-ws-00005-r6p` is healthy, while the API is still being tuned to connect to Cloud SQL due to password encoding quirks.
- Cloudflare now proxies `humanchat.com`, `api.humanchat.com`, and `ws.humanchat.com` directly to the GCP services, completing the DNS cutover away from the legacy Railway endpoints.
- Local `.env` and `infra/terraform.tfvars` contain the authoritative secret set for Firebase, Google, Stripe, Redis, and deployment tokens so we can regenerate infrastructure reproducibly.

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
- Terraform now controls GCP networking, Cloud Run services, Memorystore, Cloudflare DNS, and the Vercel project; Secret Manager integration and CI/CD wiring are still pending.
- `scripts/deploy-cloud-run.sh` remains available for manual rollouts, but day-to-day deployments now happen through `terraform apply` plus Cloud Build image pushes.
- Remaining work: finish stabilizing the Cloud SQL connectivity (password encoding + private service access), capture Cloud SQL instance/User/IAM resources in Terraform, and decommission the dormant Railway stack once parity checks pass.
- Add monitoring/alerts (Cloud Monitoring uptime checks + Log-based metrics) for the new Cloud Run endpoints and document the rollback path before opening the traffic floodgates.

## Next Steps
1. Resolve the Cloud Run API ↔ Cloud SQL connection issue (sanitize `DATABASE_URL`, verify connector reachability) and redeploy until `/health` succeeds.
2. Import/manage the Cloud SQL instance, users, and secrets in Terraform so the entire backend stack is codified; remove the old Railway resources afterward.
3. Wire Cloud Build + Terraform into GitHub Actions with workload identity federation to automate image builds and applies.
4. Add monitoring/alerting plus a runbook covering DNS rollback and log triage so the new stack can be promoted with confidence.
