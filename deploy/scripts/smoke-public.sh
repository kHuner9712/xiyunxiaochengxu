#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cat >&2 <<'EOF'
NOTICE: smoke-public.sh is a compatibility entrypoint.
Production public verification is intentionally identical to the audited smoke-runtime.sh contract:
trusted TLS, canonical domains, database/Redis health, callbacks, uploads and runtime routes.
EOF

exec bash "$SCRIPT_DIR/smoke-runtime.sh" "$@"
