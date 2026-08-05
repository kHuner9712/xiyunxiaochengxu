#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Backward-compatible entrypoint. The audited production deployment flow now
# lives in deploy-production.sh so every production deployment performs the
# same backup, migration, build-SHA, health and runtime smoke checks.
exec bash "$SCRIPT_DIR/deploy-production.sh" "$@"
