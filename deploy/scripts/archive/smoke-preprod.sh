#!/usr/bin/env bash
set -Eeuo pipefail

cat >&2 <<'EOF'
ERROR: deploy/scripts/archive/smoke-preprod.sh is an archived historical smoke script and is intentionally disabled.
It does not represent the current trusted-TLS, callback, database/Redis, upload and runtime production contract.

Use the audited runtime smoke instead:
  ENV_FILE=.env.production bash deploy/scripts/smoke-runtime.sh
EOF

exit 64
