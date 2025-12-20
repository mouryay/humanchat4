#!/usr/bin/env bash
set -euo pipefail

export PROJECT_ID=loyal-env-475400-u0
export CLOUD_SQL_INSTANCES=loyal-env-475400-u0:us-central1:users

exec "$(dirname "$0")/deploy-api.sh" "$@"
