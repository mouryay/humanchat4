#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=${SERVICE_NAME:-humanchat-api}
SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)

# Ensure Cloud Run always receives the full runtime secret set unless explicitly overridden.
# Appending missing entries protects against partial deployments silently breaking features
# (e.g. Redis fanout for chat delivery).
REQUIRED_SECRET_PAIRS=(
  "DATABASE_URL=DATABASE_URL:latest"
  "REDIS_URL=REDIS_URL:latest"
  "FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest"
  "FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest"
  "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"
  "JWT_SECRET=JWT_SECRET:latest"
  "GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest"
  "GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"
  "STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest"
  "STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest"
  "GEMINI_API_KEY=GEMINI_API_KEY:latest"
  "POSTGRES_CRYPTO_KEY=POSTGRES_CRYPTO_KEY:latest"
  "LIVEKIT_API_KEY=LIVEKIT_API_KEY:latest"
  "LIVEKIT_API_SECRET=LIVEKIT_API_SECRET:latest"
  "LIVEKIT_SERVER_URL=LIVEKIT_SERVER_URL:latest"
)

if [[ -z "${SET_SECRETS:-}" ]]; then
  SET_SECRETS=""
fi

for pair in "${REQUIRED_SECRET_PAIRS[@]}"; do
  key="${pair%%=*}"
  if [[ "${SET_SECRETS}" != *"${key}="* ]]; then
    if [[ -n "${SET_SECRETS}" ]]; then
      SET_SECRETS="${SET_SECRETS},${pair}"
    else
      SET_SECRETS="${pair}"
    fi
  fi
done

export SET_SECRETS

SERVICE_NAME="$SERVICE_NAME" "${SCRIPT_DIR}/deploy-cloud-run.sh" "$@"
