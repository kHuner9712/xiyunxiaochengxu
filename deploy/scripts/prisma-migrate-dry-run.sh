#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [ -z "${DRY_RUN_DATABASE_URL:-}" ]; then
  echo "ERROR: DRY_RUN_DATABASE_URL is required and must point to a disposable shadow/preprod database." >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ] && [ "$DRY_RUN_DATABASE_URL" = "$DATABASE_URL" ]; then
  echo "ERROR: DRY_RUN_DATABASE_URL must not equal DATABASE_URL." >&2
  exit 1
fi

if printf '%s' "$DRY_RUN_DATABASE_URL" | grep -Eqi '(prod|production|master|primary)'; then
  if [ "${ALLOW_RISKY_MIGRATE_DRY_RUN_URL:-}" != "true" ]; then
    echo "ERROR: DRY_RUN_DATABASE_URL looks like a production database. Use a disposable database or set ALLOW_RISKY_MIGRATE_DRY_RUN_URL=true after manual verification." >&2
    exit 1
  fi
fi

echo "Prisma migrate dry-run target: disposable database from DRY_RUN_DATABASE_URL"

IS_WINDOWS=false
if [ -n "${WINDIR:-}" ] || [ -n "${MSYSTEM:-}" ] || uname -r 2>/dev/null | grep -qi microsoft; then
  IS_WINDOWS=true
fi

run_with_dry_run_db() {
  if [ "$IS_WINDOWS" = true ]; then
    cmd.exe /c "pnpm exec cross-env DATABASE_URL=$DRY_RUN_DATABASE_URL pnpm --filter @baby-mall/api $*"
  else
    DATABASE_URL="$DRY_RUN_DATABASE_URL" pnpm --filter @baby-mall/api "$@"
  fi
}

run_with_dry_run_db prisma:migrate:deploy
run_with_dry_run_db exec prisma migrate status
