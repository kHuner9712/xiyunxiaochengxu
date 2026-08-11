#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Legacy compatibility entrypoint. Production deployment has exactly one
# implementation so old runbooks/automation cannot bypass release identity,
# migration rehearsal, backup, rollback, health, and runtime-smoke gates.
exec bash "$SCRIPT_DIR/deploy-production.sh" "$@"
