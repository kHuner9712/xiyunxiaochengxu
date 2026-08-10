#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.yml"
RAW_ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"

if [[ "$RAW_ENV_FILE" = /* ]]; then
  ENV_FILE="$RAW_ENV_FILE"
else
  ENV_FILE="$(pwd)/$RAW_ENV_FILE"
fi

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'PASS %s\n' "$1"
}

read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | sed -E "s/^[[:space:]]*(export[[:space:]]+)?${key}=//" || true)"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

container_payment_path_to_host() {
  local container_path="$1"
  local label="$2"
  local prefix='/app/apps/api/certs/'
  local relative_path

  [ -n "$container_path" ] || fail "$label container path is empty"
  case "$container_path" in
    "$prefix"*) ;;
    *) fail "$label must be inside the mounted certificate directory $prefix; configured=$container_path" ;;
  esac

  relative_path="${container_path#"$prefix"}"
  case "$relative_path" in
    ''|/*|..|../*|*/..|*/../*) fail "$label contains an unsafe certificate path: $container_path" ;;
  esac

  local host_path="$ROOT_DIR/deploy/certs/$relative_path"
  [ -r "$host_path" ] || fail "$label is not readable at the host path mapped from $container_path: $host_path"
  printf '%s' "$host_path"
}

wait_healthy() {
  local container="$1"
  local attempts="${2:-60}"
  for attempt in $(seq 1 "$attempts"); do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    printf '%s health check %s/%s: %s\n' "$container" "$attempt" "$attempts" "${status:-missing}"
    if [ "$status" = 'healthy' ]; then return 0; fi
    if [ "$status" = 'unhealthy' ] || [ "$status" = 'exited' ]; then return 1; fi
    sleep 5
  done
  return 1
}

validate_tls_pair() {
  local cert="$1"
  local key="$2"
  local domain="$3"
  local label="$4"
  local cert_pubkey
  local key_pubkey

  openssl x509 -in "$cert" -noout >/dev/null 2>&1 || fail "$label TLS certificate is not a valid X.509 certificate: $cert"
  openssl pkey -in "$key" -noout >/dev/null 2>&1 || fail "$label TLS private key is invalid or unreadable: $key"
  openssl x509 -in "$cert" -checkend 604800 -noout >/dev/null 2>&1 || fail "$label TLS certificate is expired or expires within 7 days: $cert"
  openssl x509 -in "$cert" -checkhost "$domain" -noout >/dev/null 2>&1 || fail "$label TLS certificate does not cover domain $domain"

  cert_pubkey="$(openssl x509 -in "$cert" -pubkey -noout 2>/dev/null | openssl pkey -pubin -outform PEM 2>/dev/null)" || fail "$label TLS certificate public key cannot be read"
  key_pubkey="$(openssl pkey -in "$key" -pubout -outform PEM 2>/dev/null)" || fail "$label TLS private key public key cannot be derived"
  [ "$cert_pubkey" = "$key_pubkey" ] || fail "$label TLS certificate and private key do not match"
}

validate_wechat_payment_material() {
  local private_key="$1"
  local platform_cert="$2"
  local configured_serial="$3"
  local actual_serial
  local normalized_configured_serial

  openssl pkey -in "$private_key" -noout >/dev/null 2>&1 || fail "WeChat merchant private key is not a valid readable PEM private key: $private_key"
  openssl x509 -in "$platform_cert" -noout >/dev/null 2>&1 || fail "WeChat platform certificate is not a valid X.509 PEM certificate: $platform_cert"
  openssl x509 -in "$platform_cert" -checkend 604800 -noout >/dev/null 2>&1 || fail "WeChat platform certificate is expired or expires within 7 days: $platform_cert"

  actual_serial="$(openssl x509 -in "$platform_cert" -noout -serial | sed -E 's/^serial=//' | tr -d '[:space:]:' | tr '[:lower:]' '[:upper:]')"
  normalized_configured_serial="$(printf '%s' "$configured_serial" | tr -d '[:space:]:' | tr '[:lower:]' '[:upper:]')"
  [ -n "$normalized_configured_serial" ] || fail 'WECHAT_PLATFORM_CERT_SERIAL_NO is empty'
  [ -n "$actual_serial" ] || fail "cannot read WeChat platform certificate serial number: $platform_cert"
  [ "$actual_serial" = "$normalized_configured_serial" ] || fail "WECHAT_PLATFORM_CERT_SERIAL_NO does not match the configured platform certificate: configured=$normalized_configured_serial actual=$actual_serial"
}

command -v git >/dev/null 2>&1 || fail 'git is not installed'
command -v docker >/dev/null 2>&1 || fail 'docker is not installed'
command -v gzip >/dev/null 2>&1 || fail 'gzip is not installed'
command -v openssl >/dev/null 2>&1 || fail 'openssl is not installed'
docker compose version >/dev/null 2>&1 || fail 'docker compose is unavailable'
[ -r "$ENV_FILE" ] || fail "production env file is not readable: $ENV_FILE"

EXPECTED_API_DOMAIN="${API_DOMAIN:-api.yunxixiaochengxu.com.cn}"
EXPECTED_ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.yunxixiaochengxu.com.cn}"
EXPECTED_MINIPROGRAM_APP_ID="wxe40f76a33427090f"
EXPECTED_UPLOAD_PUBLIC_URL="https://${EXPECTED_API_DOMAIN}"
EXPECTED_PAY_NOTIFY_URL="https://${EXPECTED_API_DOMAIN}/api/weapp/pay/callback"
EXPECTED_REFUND_NOTIFY_URL="https://${EXPECTED_API_DOMAIN}/api/weapp/pay/refund-callback"
CONFIGURED_WECHAT_APP_ID="$(read_env_value WECHAT_APP_ID)"
CONFIGURED_UPLOAD_PUBLIC_URL="$(read_env_value UPLOAD_PUBLIC_URL)"
CONFIGURED_UPLOAD_PUBLIC_URL="${CONFIGURED_UPLOAD_PUBLIC_URL%/}"
CONFIGURED_PAY_NOTIFY_URL="$(read_env_value WECHAT_NOTIFY_URL)"
CONFIGURED_REFUND_NOTIFY_URL="$(read_env_value WECHAT_REFUND_NOTIFY_URL)"
CONFIGURED_WECHAT_PRIVATE_KEY_PATH="$(read_env_value WECHAT_PRIVATE_KEY_PATH)"
CONFIGURED_WECHAT_PRIVATE_KEY_PATH="${CONFIGURED_WECHAT_PRIVATE_KEY_PATH:-/app/apps/api/certs/apiclient_key.pem}"
CONFIGURED_WECHAT_PLATFORM_CERT_PATH="$(read_env_value WECHAT_PLATFORM_CERT_PATH)"
CONFIGURED_WECHAT_PLATFORM_CERT_PATH="${CONFIGURED_WECHAT_PLATFORM_CERT_PATH:-/app/apps/api/certs/wechatpay_platform.pem}"
CONFIGURED_WECHAT_PLATFORM_CERT_SERIAL_NO="$(read_env_value WECHAT_PLATFORM_CERT_SERIAL_NO)"
[ "$CONFIGURED_WECHAT_APP_ID" = "$EXPECTED_MINIPROGRAM_APP_ID" ] || fail "WECHAT_APP_ID must match the miniprogram AppID $EXPECTED_MINIPROGRAM_APP_ID; configured=${CONFIGURED_WECHAT_APP_ID:-empty}"
[ "$CONFIGURED_UPLOAD_PUBLIC_URL" = "$EXPECTED_UPLOAD_PUBLIC_URL" ] || fail "UPLOAD_PUBLIC_URL must exactly match $EXPECTED_UPLOAD_PUBLIC_URL so generated public asset URLs use the deployed API origin; configured=${CONFIGURED_UPLOAD_PUBLIC_URL:-empty}"
[ "$CONFIGURED_PAY_NOTIFY_URL" = "$EXPECTED_PAY_NOTIFY_URL" ] || fail "WECHAT_NOTIFY_URL must exactly match $EXPECTED_PAY_NOTIFY_URL; configured=${CONFIGURED_PAY_NOTIFY_URL:-empty}"
[ "$CONFIGURED_REFUND_NOTIFY_URL" = "$EXPECTED_REFUND_NOTIFY_URL" ] || fail "WECHAT_REFUND_NOTIFY_URL must exactly match $EXPECTED_REFUND_NOTIFY_URL; configured=${CONFIGURED_REFUND_NOTIFY_URL:-empty}"
pass 'miniprogram AppID, public asset origin, and WeChat callback URLs match the deployed production routes'

cd "$ROOT_DIR"
[ -z "$(git status --porcelain)" ] || fail 'Git worktree is not clean; stop before production deployment'

CURRENT_BRANCH="$(git branch --show-current)"
[ "$CURRENT_BRANCH" = 'main' ] || fail "production deployment must run from main; current branch is '${CURRENT_BRANCH:-detached}'"

FULL_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
BUILD_SHA="$FULL_SHA"
EXPECTED_DEPLOY_SHA="${EXPECTED_DEPLOY_SHA:-}"
[[ "$EXPECTED_DEPLOY_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail 'EXPECTED_DEPLOY_SHA is required and must be the exact 40-character commit SHA approved for deployment'
EXPECTED_DEPLOY_SHA="$(printf '%s' "$EXPECTED_DEPLOY_SHA" | tr 'A-F' 'a-f')"
[ "$FULL_SHA" = "$EXPECTED_DEPLOY_SHA" ] || fail "HEAD $FULL_SHA does not match EXPECTED_DEPLOY_SHA $EXPECTED_DEPLOY_SHA"

# A production deploy must use the current remote main tip, not an arbitrary local checkout.
git fetch --quiet origin main || fail 'failed to refresh origin/main before production deployment'
REMOTE_MAIN_SHA="$(git rev-parse origin/main)"
[ "$FULL_SHA" = "$REMOTE_MAIN_SHA" ] || fail "HEAD $FULL_SHA is not the current origin/main tip $REMOTE_MAIN_SHA"
pass "release identity verified: main@$FULL_SHA"

# BUILD_SHA is an externally observable deployment identity and must remain the exact commit.
# SHORT_SHA is only for local operational resource names where the full hash is unnecessarily long.
export BUILD_SHA
DEPLOY_TIME="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/deploy/backups"
BACKUP_FILE="$BACKUP_DIR/mysql-before-${SHORT_SHA}-${DEPLOY_TIME}.sql.gz"
ROLLBACK_TAG="baby-mall-api:rollback-${SHORT_SHA}-${DEPLOY_TIME}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

printf 'Deploy commit: %s (%s)\n' "$SHORT_SHA" "$FULL_SHA"
"${COMPOSE[@]}" config --quiet
pass 'docker compose configuration is valid'

WECHAT_PRIVATE_KEY_HOST_PATH="$(container_payment_path_to_host "$CONFIGURED_WECHAT_PRIVATE_KEY_PATH" 'WECHAT_PRIVATE_KEY_PATH')"
WECHAT_PLATFORM_CERT_HOST_PATH="$(container_payment_path_to_host "$CONFIGURED_WECHAT_PLATFORM_CERT_PATH" 'WECHAT_PLATFORM_CERT_PATH')"
for cert in \
  "$ROOT_DIR/deploy/nginx/ssl/api/fullchain.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/api/privkey.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/admin/fullchain.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/admin/privkey.pem"; do
  [ -r "$cert" ] || fail "required TLS certificate material is not readable: $cert"
done
pass 'configured payment and TLS certificate files are readable'

validate_wechat_payment_material \
  "$WECHAT_PRIVATE_KEY_HOST_PATH" \
  "$WECHAT_PLATFORM_CERT_HOST_PATH" \
  "$CONFIGURED_WECHAT_PLATFORM_CERT_SERIAL_NO"
pass 'WeChat merchant private key and platform certificate are valid, current, and serial-consistent'

validate_tls_pair \
  "$ROOT_DIR/deploy/nginx/ssl/api/fullchain.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/api/privkey.pem" \
  "$EXPECTED_API_DOMAIN" \
  'API'
validate_tls_pair \
  "$ROOT_DIR/deploy/nginx/ssl/admin/fullchain.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/admin/privkey.pem" \
  "$EXPECTED_ADMIN_DOMAIN" \
  'Admin'
pass 'TLS certificates cover production domains, match their private keys, and remain valid for at least 7 days'

if [ -n "${EXPECTED_SERVER_IP:-}" ]; then
  command -v getent >/dev/null 2>&1 || fail 'getent is required when EXPECTED_SERVER_IP is set'
  for domain in "$EXPECTED_API_DOMAIN" "$EXPECTED_ADMIN_DOMAIN"; do
    resolved="$(getent ahostsv4 "$domain" | awk '{print $1}' | sort -u || true)"
    echo "$resolved" | grep -qx "$EXPECTED_SERVER_IP" || fail "$domain does not resolve to EXPECTED_SERVER_IP=$EXPECTED_SERVER_IP"
  done
  pass 'production DNS matches EXPECTED_SERVER_IP'
fi

OLD_API_IMAGE="$(docker inspect --format '{{.Image}}' baby-mall-api 2>/dev/null || true)"
if [ -n "$OLD_API_IMAGE" ]; then
  docker image tag "$OLD_API_IMAGE" "$ROLLBACK_TAG"
  pass "previous API image tagged as $ROLLBACK_TAG"
fi

"${COMPOSE[@]}" up -d mysql redis
wait_healthy baby-mall-mysql 60 || fail 'MySQL did not become healthy'
wait_healthy baby-mall-redis 60 || fail 'Redis did not become healthy'

mkdir -p "$BACKUP_DIR"
"${COMPOSE[@]}" exec -T mysql sh -c '
  exec mysqldump \
    -uroot \
    -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    "$MYSQL_DATABASE"
' | gzip -9 > "$BACKUP_FILE"

gzip -t "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || fail 'database backup is empty'
pass "database backup created: $BACKUP_FILE"

"${COMPOSE[@]}" build --pull api
pass "API and admin image built with BUILD_SHA=$BUILD_SHA"

# Before touching the live schema, restore the actual production backup into a disposable
# MySQL clone and run migrations with the exact image that will be deployed.
API_IMAGE_ID="$("${COMPOSE[@]}" images -q api | head -n 1)"
[ -n "$API_IMAGE_ID" ] || fail 'cannot resolve newly built API image for migration clone verification'

DRY_RUN_NETWORK="baby-mall-migrate-check-${SHORT_SHA}-${DEPLOY_TIME}"
DRY_RUN_DB_CONTAINER="baby-mall-migrate-db-${SHORT_SHA}-${DEPLOY_TIME}"
DRY_RUN_DB_NAME="baby_mall_migrate_verify"
DRY_RUN_DB_PASSWORD="verify${RANDOM}${RANDOM}${RANDOM}${RANDOM}"
DRY_RUN_DATABASE_URL="mysql://root:${DRY_RUN_DB_PASSWORD}@mysql-check:3306/${DRY_RUN_DB_NAME}"

cleanup_migration_clone() {
  docker rm -f "$DRY_RUN_DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$DRY_RUN_NETWORK" >/dev/null 2>&1 || true
}
trap cleanup_migration_clone EXIT
cleanup_migration_clone

docker network create "$DRY_RUN_NETWORK" >/dev/null
docker run -d \
  --name "$DRY_RUN_DB_CONTAINER" \
  --network "$DRY_RUN_NETWORK" \
  --network-alias mysql-check \
  -e MYSQL_ROOT_PASSWORD="$DRY_RUN_DB_PASSWORD" \
  -e MYSQL_DATABASE="$DRY_RUN_DB_NAME" \
  --health-cmd='mysqladmin ping -h 127.0.0.1 -p"$MYSQL_ROOT_PASSWORD"' \
  --health-interval=5s \
  --health-timeout=5s \
  --health-retries=20 \
  mysql:8.0 >/dev/null
wait_healthy "$DRY_RUN_DB_CONTAINER" 60 || fail 'migration verification MySQL clone did not become healthy'

gzip -dc "$BACKUP_FILE" | docker exec -i "$DRY_RUN_DB_CONTAINER" \
  mysql -uroot -p"$DRY_RUN_DB_PASSWORD" "$DRY_RUN_DB_NAME"
pass 'production backup restored into disposable migration clone'

docker run --rm \
  --network "$DRY_RUN_NETWORK" \
  -e DATABASE_URL="$DRY_RUN_DATABASE_URL" \
  "$API_IMAGE_ID" npx prisma migrate deploy

docker run --rm \
  --network "$DRY_RUN_NETWORK" \
  -e DATABASE_URL="$DRY_RUN_DATABASE_URL" \
  "$API_IMAGE_ID" npx prisma migrate status

# migrate status only proves migration history. A historical production database can still carry
# manual/legacy schema drift, so compare the migrated clone itself against the release schema.
docker run --rm \
  --network "$DRY_RUN_NETWORK" \
  -e DATABASE_URL="$DRY_RUN_DATABASE_URL" \
  "$API_IMAGE_ID" sh -c 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code'
pass 'production-backup migration clone passed migrations and schema drift verification with the deployment image'

cleanup_migration_clone
trap - EXIT

# Only after the production-backup clone passes do we migrate the live database.
"${COMPOSE[@]}" run --rm --no-deps api npx prisma migrate deploy
pass 'Prisma migrations completed on live database'

SKIP_MIGRATE=true "${COMPOSE[@]}" up -d --no-deps api
if ! wait_healthy baby-mall-api 60; then
  docker logs --tail 250 baby-mall-api >&2 || true
  [ -z "$OLD_API_IMAGE" ] || printf 'Rollback image: %s\n' "$ROLLBACK_TAG" >&2
  fail 'API did not become healthy after deployment'
fi
pass 'API container is healthy'

"${COMPOSE[@]}" up -d --no-deps --force-recreate nginx
sleep 3
docker exec baby-mall-nginx nginx -t >/dev/null
pass 'Nginx configuration is valid'

ENV_FILE="$ENV_FILE" \
API_DOMAIN="$EXPECTED_API_DOMAIN" \
ADMIN_DOMAIN="$EXPECTED_ADMIN_DOMAIN" \
bash "$SCRIPT_DIR/smoke-runtime.sh"

printf 'DEPLOYMENT PASS\n'
printf 'Commit: %s\n' "$FULL_SHA"
printf 'Database backup: %s\n' "$BACKUP_FILE"
if [ -n "$OLD_API_IMAGE" ]; then printf 'Rollback image: %s\n' "$ROLLBACK_TAG"; fi
