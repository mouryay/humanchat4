# Environment Setup Guide

## Overview
Use this guide to configure production, staging, and local environments for HumanChat. Secrets live in 1Password + provider secret managers; never commit them to git.

## Required Variables

| Scope | Key | Description |
| --- | --- | --- |
| Frontend | `NEXT_PUBLIC_API_URL` | HTTPS URL for the public API (`https://api.humanchat.com`). |
| Frontend | `NEXT_PUBLIC_WS_URL` | WSS endpoint for real-time updates. |
| Frontend | `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Publishable Stripe key. |
| Frontend | `NEXT_PUBLIC_GEMINI_API_KEY` | Optional Gemini key for client-side experiments. |
| Frontend | `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key for client auth flows. |
| Frontend | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g., `project.firebaseapp.com`). |
| Frontend | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID so the client can bootstrap. |
| Backend | `FIREBASE_PROJECT_ID` | Same Firebase project ID used by the admin SDK. |
| Backend | `FIREBASE_CLIENT_EMAIL` | Service-account client email for Firebase Admin. |
| Backend | `FIREBASE_PRIVATE_KEY` | Private key (escape `\n`) for Firebase Admin credentials. |
| Backend | `DATABASE_URL` | Cloud SQL connection string (stored in Secret Manager as `cloudsql-database-url`). |
| Backend | `REDIS_URL` | Upstash Redis REST/Redis URL. |
| Backend | `JWT_SECRET` | 32+ char secret for user tokens. |
| Backend | `STRIPE_SECRET_KEY` | Live-mode Stripe secret. |
| Backend | `STRIPE_WEBHOOK_SECRET` | Webhook verifier from Stripe dashboard. |
| Backend | `CORS_ORIGINS` | Comma-separated list of allowed origins (supports `*` wildcards). |
| Backend | `GEMINI_API_KEY` | Server-side Gemini key. |
| Backend | `GOOGLE_OAUTH_CLIENT_ID` | OAuth client. |
| Backend | `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth secret. |
| Backend | `POSTGRES_CRYPTO_KEY` | Symmetric key used when encrypting calendar OAuth tokens (feeds `humanchat.crypto_key`). |

### Optional additions
- `SENTRY_DSN`, `POSTHOG_API_KEY`, `BETTER_UPTIME_HEARTBEAT`
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`

## Local Development Environment File Structure

**Why are there multiple `.env` files?**

The project uses a **monorepo structure** with separate frontend (Next.js) and backend (Express) applications that require different environment configurations:

```
humanchat4/                          (root)
├── .env.backend.local               ← Backend API uses this (database, Redis, JWT secrets)
├── apps/
│   └── web/
│       ├── .env.local               ← Next.js frontend uses this (API URLs, Firebase client config)
│       └── next.config.mjs
```

**Which file does each command use?**

| Command | Application | Working Directory | Env File Used | Purpose |
|---------|-------------|-------------------|---------------|---------|
| `npm run dev` | Backend API (Express) | Root `humanchat4/` | `.env.backend.local` | Server logic, database connections, secrets |
| `npm run web:dev` | Frontend (Next.js) | `apps/web/` | `apps/web/.env.local` | Browser code, API endpoints, Firebase client |

**Why separate files?**

1. **Security**: Backend needs sensitive secrets (database passwords, JWT secrets, Firebase admin keys) that must **never** be exposed to the browser
2. **Next.js behavior**: Next.js automatically looks for `.env.local` in the same directory as `next.config.mjs`, not in the project root
3. **Deployment separation**: Frontend deploys to Vercel, backend to Cloud Run - each needs different configuration
4. **Environment isolation**: Backend connects directly to PostgreSQL/Redis, while frontend only needs HTTP/WebSocket URLs

**⚠️ Common mistake**: Creating `.env.local` in the root directory - this file is **ignored** by both applications. Always use:
- `apps/web/.env.local` for frontend changes
- `.env.backend.local` for backend changes

## Procedure
1. Duplicate `.env.example` to `.env.backend.local` for backend local dev; fill with sandbox credentials.
2. Create `apps/web/.env.local` for frontend local dev with localhost API URLs.
3. Run `./scripts/verify-env.sh` before any deploy pipeline.
4. In Vercel project settings, add frontend keys under **Environment Variables → Production**.
5. In Cloud Run service configuration, set backend keys (or reference Secret Manager entries) for each environment.
6. Store master secrets in 1Password; reference them via GitHub Actions secrets (`VERCEL_TOKEN`, `GCP_SA_KEY`, etc.).
7. Rotate secrets quarterly or immediately after an incident; update IaC variable files and provider dashboards.

### Cloud SQL + Secret Manager
1. Create the Cloud SQL instance (e.g., `loyal-env-475400-u0:us-central1:users`) and confirm the target database (default `postgres`).
2. Reset or create a SQL user password, then store it in Secret Manager (`cloudsql-db-password`).
3. Create the connection-string secret:
	- `postgresql://postgres:<password>@/postgres?host=/cloudsql/<instance>` → `cloudsql-database-url`.
4. When deploying Cloud Run, pass `CLOUD_SQL_INSTANCES=<instance>` and set `SET_SECRETS="DATABASE_URL=cloudsql-database-url:latest,..."` so the service mounts the connector and reads the secret directly.
5. All environments (local, staging, production) use the same Cloud SQL connection secrets; Supabase is no longer part of the stack.

## Promotion Flow
- Update staging environment first, run smoke tests.
- Once staging is healthy, copy values to production via provider dashboards or Terraform variable files/Secret Manager copy.

## Validation Checklist
- `npm run test` passes.
- `scripts/verify-env.sh` outputs "Environment ready.".
- `curl https://api.humanchat.com/health` returns 200 from staging + prod.
