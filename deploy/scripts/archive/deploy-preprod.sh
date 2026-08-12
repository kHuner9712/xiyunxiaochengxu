#!/usr/bin/env bash
set -Eeuo pipefail

cat >&2 <<'EOF'
ERROR: deploy/scripts/archive/deploy-preprod.sh is an archived historical script and is intentionally disabled.
It must not be used for production or preproduction deployment because it bypasses the current release identity,
production preflight, quiesced backup-clone migration verification, rollback choreography and runtime smoke gates.

Use the only supported deployment entrypoint instead:
  EXPECTED_DEPLOY_SHA=<approved full 40-character main SHA> \
  ENV_FILE=.env.production \
  bash deploy/scripts/deploy-production.sh
EOF

exit 64
