#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
API_DOMAIN="${API_DOMAIN:-api.yunxixiaochengxu.com.cn}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.yunxixiaochengxu.com.cn}"

PASS_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | sed -E "s/^[[:space:]]*(export[[:space:]]+)?${key}=//" || true)"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "${value:-$fallback}"
}

[ -r "$ENV_FILE" ] || fail "production env file is not readable: $ENV_FILE"
command -v docker >/dev/null 2>&1 || fail 'docker is not installed'
command -v curl >/dev/null 2>&1 || fail 'curl is not installed'
docker compose version >/dev/null 2>&1 || fail 'docker compose is unavailable'

API_HOST_PORT="$(read_env_value API_HOST_PORT 3001)"
MYSQL_HOST_PORT="$(read_env_value MYSQL_HOST_PORT 3307)"
REDIS_HOST_PORT="$(read_env_value REDIS_HOST_PORT 6379)"
HTTP_HOST_PORT="$(read_env_value HTTP_HOST_PORT 80)"
HTTPS_HOST_PORT="$(read_env_value HTTPS_HOST_PORT 443)"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

"${COMPOSE[@]}" config --quiet
pass 'docker compose configuration is valid'

for container in baby-mall-mysql baby-mall-redis baby-mall-api baby-mall-nginx; do
  running="$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null || true)"
  [ "$running" = 'true' ] || fail "$container is not running"
  pass "$container is running"
done

for container in baby-mall-mysql baby-mall-redis baby-mall-api; do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || true)"
  [ "$health" = 'healthy' ] || fail "$container health is $health"
  pass "$container is healthy"
done

mysql_port="$(docker port baby-mall-mysql 3306/tcp 2>/dev/null || true)"
redis_port="$(docker port baby-mall-redis 6379/tcp 2>/dev/null || true)"
api_port="$(docker port baby-mall-api 3000/tcp 2>/dev/null || true)"
nginx_http_port="$(docker port baby-mall-nginx 80/tcp 2>/dev/null || true)"
nginx_https_port="$(docker port baby-mall-nginx 443/tcp 2>/dev/null || true)"

[[ "$mysql_port" == *"127.0.0.1:${MYSQL_HOST_PORT}"* ]] || fail "MySQL is not bound to 127.0.0.1:${MYSQL_HOST_PORT}: $mysql_port"
[[ "$redis_port" == *"127.0.0.1:${REDIS_HOST_PORT}"* ]] || fail "Redis is not bound to 127.0.0.1:${REDIS_HOST_PORT}: $redis_port"
[[ "$api_port" == *"127.0.0.1:${API_HOST_PORT}"* ]] || fail "API is not bound to 127.0.0.1:${API_HOST_PORT}: $api_port"
[[ "$nginx_http_port" == *":${HTTP_HOST_PORT}"* ]] || fail "Nginx HTTP port mismatch: $nginx_http_port"
[[ "$nginx_https_port" == *":${HTTPS_HOST_PORT}"* ]] || fail "Nginx HTTPS port mismatch: $nginx_https_port"
pass 'host port bindings match the runtime contract'

docker exec baby-mall-mysql sh -c 'exec mysqladmin ping -h localhost -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null
pass 'MySQL accepts authenticated health checks'

docker exec baby-mall-redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -qx PONG'
pass 'Redis accepts authenticated health checks'

api_health="$(curl --fail --silent --show-error "http://127.0.0.1:${API_HOST_PORT}/api/health")"
echo "$api_health" | grep -q '"status":"ok"' || fail "API health response is not ok: $api_health"
echo "$api_health" | grep -q '"database":"ok"' || fail "API health does not report database=ok: $api_health"
echo "$api_health" | grep -q '"redis":"ok"' || fail "API health does not report redis=ok: $api_health"
api_build_sha="$(printf '%s' "$api_health" | sed -n 's/.*"buildSha":"\([^"]*\)".*/\1/p')"
[[ "$api_build_sha" =~ ^[0-9a-fA-F]{40}$ ]] || fail "API health buildSha must be the exact 40-character Git commit SHA: ${api_build_sha:-empty}"
if [ -n "${BUILD_SHA:-}" ]; then
  [ "$api_build_sha" = "$BUILD_SHA" ] || fail "API runtime build SHA mismatch: expected=$BUILD_SHA actual=$api_build_sha"
fi
pass "loopback API health, database, Redis and build identity checks pass ($api_build_sha)"

nginx_api_health="$(curl --fail --silent --show-error --insecure \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/api/health")"
echo "$nginx_api_health" | grep -q '"status":"ok"' || fail "Nginx API proxy health is not ok: $nginx_api_health"
nginx_build_sha="$(printf '%s' "$nginx_api_health" | sed -n 's/.*"buildSha":"\([^"]*\)".*/\1/p')"
[ "$nginx_build_sha" = "$api_build_sha" ] || fail "Nginx API build SHA mismatch: loopback=$api_build_sha nginx=$nginx_build_sha"
pass 'HTTPS API virtual host proxies to the same API build'

product_list_response="$(curl --fail --silent --show-error --insecure \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/api/weapp/product/list?page=1&pageSize=1")"
echo "$product_list_response" | grep -Eq '"code"[[:space:]]*:[[:space:]]*0' || fail "public product list API did not return code=0: $product_list_response"
echo "$product_list_response" | grep -Eq '"data"[[:space:]]*:' || fail "public product list API response has no data envelope: $product_list_response"
echo "$product_list_response" | grep -Eq '"list"[[:space:]]*:' || fail "public product list API response has no data.list: $product_list_response"
echo "$product_list_response" | grep -Eq '"total"[[:space:]]*:' || fail "public product list API response has no data.total: $product_list_response"
pass 'public product list works through production HTTPS, controller, response envelope and database query path'

admin_html="$(curl --fail --silent --show-error --insecure \
  --resolve "${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}/")"
echo "$admin_html" | grep -Eqi '<!doctype html|<html' || fail 'admin virtual host did not return the SPA entry page'
pass 'HTTPS admin virtual host serves the SPA'

redirect_code="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --resolve "${API_DOMAIN}:${HTTP_HOST_PORT}:127.0.0.1" \
  "http://${API_DOMAIN}:${HTTP_HOST_PORT}/api/health")"
[ "$redirect_code" = '301' ] || fail "HTTP to HTTPS redirect returned $redirect_code"
pass 'HTTP traffic redirects to HTTPS'

docker exec baby-mall-nginx nginx -t >/dev/null
nginx_dump="$(docker exec baby-mall-nginx nginx -T 2>/dev/null)"
echo "$nginx_dump" | grep -q 'proxy_pass http://api:3000;' || fail 'running Nginx does not proxy to api:3000'
limit_count="$(echo "$nginx_dump" | grep -c 'client_max_body_size 60m;' || true)"
[ "$limit_count" -ge 2 ] || fail "running Nginx does not expose the 60m upload limit in both virtual hosts"
pass 'running Nginx configuration and upload limits are valid'

private_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --insecure \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/uploads/private/runtime-smoke")"
[ "$private_status" = '403' ] || fail "private upload path returned HTTP $private_status instead of 403"
pass 'private uploads are blocked by Nginx'

image_hash="$(docker exec baby-mall-api cat /app/admin-dist/.build-hash 2>/dev/null | tr -d '\r\n' || true)"
served_hash="$(curl --fail --silent --show-error --insecure \
  --resolve "${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}/.build-hash" | tr -d '\r\n')"
[ -n "$image_hash" ] || fail 'API image does not contain /app/admin-dist/.build-hash'
[ "$image_hash" = "$served_hash" ] || fail "admin build hash mismatch: image=$image_hash served=$served_hash"
[ "$image_hash" = "$api_build_sha" ] || fail "API/admin build identity mismatch: api=$api_build_sha admin=$image_hash"
[[ "$served_hash" =~ ^[0-9a-fA-F]{40}$ ]] || fail "admin build hash must be the exact 40-character Git commit SHA: ${served_hash:-empty}"
pass "API and admin static volume match image build $served_hash"

printf 'RUNTIME SMOKE PASS (%d checks)\n' "$PASS_COUNT"
