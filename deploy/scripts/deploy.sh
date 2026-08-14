#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cat >&2 <<'EOF'
NOTICE: deploy/scripts/deploy.sh is a compatibility entrypoint only.
All production deployments are enforced through deploy-production.sh so release identity,
production preflight, write quiescing, backup-clone migration verification, rollback handling,
and runtime smoke checks cannot be bypassed.
EOF

exec bash "$SCRIPT_DIR/deploy-production.sh" "$@"
