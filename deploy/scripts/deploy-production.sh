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

command -v git >/dev/null 2>&1 || fail 'git is not installed'
command -v docker >/dev/null 2>&1 || fail 'docker is not installed'
command -v gzip >/dev/null 2>&1 || fail 'gzip is not installed'
docker compose version >/dev/null 2>&1 || fail 'docker compose is unavailable'
[ -r "$ENV_FILE" ] || fail "production env file is not readable: $ENV_FILE"

cd "$ROOT_DIR"
[ -z "$(git status --porcelain)" ] || fail 'Git worktree is not clean; stop before production deployment'

CURRENT_BRANCH="$(git branch --show-current)"
[ "$CURRENT_BRANCH" = 'main' ] || fail "production deployment must run from main; current branch is '${CURRENT_BRANCH:-detached}'"

FULL_SHA="$(git rev-parse HEAD)"
BUILD_SHA="$(git rev-parse --short HEAD)"
EXPECTED_DEPLOY_SHA="${EXPECTED_DEPLOY_SHA:-}"
[[ "$EXPECTED_DEPLOY_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail 'EXPECTED_DEPLOY_SHA is required and must be the exact 40-character commit SHA approved for deployment'
EXPECTED_DEPLOY_SHA="$(printf '%s' "$EXPECTED_DEPLOY_SHA" | tr 'A-F' 'a-f')"
[ "$FULL_SHA" = "$EXPECTED_DEPLOY_SHA" ] || fail "HEAD $FULL_SHA does not match EXPECTED_DEPLOY_SHA $EXPECTED_DEPLOY_SHA"

# A production deploy must use the current remote main tip, not an arbitrary local checkout.
git fetch --quiet origin main || fail 'failed to refresh origin/main before production deployment'
REMOTE_MAIN_SHA="$(git rev-parse origin/main)"
[ "$FULL_SHA" = "$REMOTE_MAIN_SHA" ] || fail "HEAD $FULL_SHA is not the current origin/main tip $REMOTE_MAIN_SHA"
pass "release identity verified: main@$FULL_SHA"

export BUILD_SHA
DEPLOY_TIME="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/deploy/backups"
BACKUP_FILE="$BACKUP_DIR/mysql-before-${BUILD_SHA}-${DEPLOY_TIME}.sql.gz"
ROLLBACK_TAG="baby-mall-api:rollback-${BUILD_SHA}-${DEPLOY_TIME}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

printf 'Deploy commit: %s (%s)\n' "$BUILD_SHA" "$FULL_SHA"
"${COMPOSE[@]}" config --quiet
pass 'docker compose configuration is valid'

for cert in \
  "$ROOT_DIR/deploy/certs/apiclient_key.pem" \
  "$ROOT_DIR/deploy/certs/wechatpay_platform.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/api/fullchain.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/api/privkey.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/admin/fullchain.pem" \
  "$ROOT_DIR/deploy/nginx/ssl/admin/privkey.pem"; do
  [ -r "$cert" ] || fail "required certificate is not readable: $cert"
done
pass 'payment and TLS certificate files are readable'

if [ -n "${EXPECTED_SERVER_IP:-}" ]; then
  command -v getent >/dev/null 2>&1 || fail 'getent is required when EXPECTED_SERVER_IP is set'
  for domain in "${API_DOMAIN:-api.yunxixiaochengxu.com.cn}" "${ADMIN_DOMAIN:-admin.yunxixiaochengxu.com.cn}"; do
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

DRY_RUN_NETWORK="baby-mall-migrate-check-${BUILD_SHA}-${DEPLOY_TIME}"
DRY_RUN_DB_CONTAINER="baby-mall-migrate-db-${BUILD_SHA}-${DEPLOY_TIME}"
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
pass 'production-backup migration clone passed with the deployment image'

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
API_DOMAIN="${API_DOMAIN:-api.yunxixiaochengxu.com.cn}" \
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.yunxixiaochengxu.com.cn}" \
bash "$SCRIPT_DIR/smoke-runtime.sh"

printf 'DEPLOYMENT PASS\n'
printf 'Commit: %s\n' "$FULL_SHA"
printf 'Database backup: %s\n' "$BACKUP_FILE"
if [ -n "$OLD_API_IMAGE" ]; then printf 'Rollback image: %s\n' "$ROLLBACK_TAG"; fi
