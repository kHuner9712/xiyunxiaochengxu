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

nginx_api_health="$(curl --fail --silent --show-error \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/api/health")"
echo "$nginx_api_health" | grep -q '"status":"ok"' || fail "Nginx API proxy health is not ok: $nginx_api_health"
nginx_build_sha="$(printf '%s' "$nginx_api_health" | sed -n 's/.*"buildSha":"\([^"]*\)".*/\1/p')"
[ "$nginx_build_sha" = "$api_build_sha" ] || fail "Nginx API build SHA mismatch: loopback=$api_build_sha nginx=$nginx_build_sha"
pass 'HTTPS API virtual host presents trusted TLS and proxies to the same API build'

product_list_response="$(curl --fail --silent --show-error \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/api/weapp/product/list?page=1&pageSize=1")"
echo "$product_list_response" | grep -Eq '"code"[[:space:]]*:[[:space:]]*0' || fail "public product list API did not return code=0: $product_list_response"
echo "$product_list_response" | grep -Eq '"data"[[:space:]]*:' || fail "public product list API response has no data envelope: $product_list_response"
echo "$product_list_response" | grep -Eq '"list"[[:space:]]*:' || fail "public product list API response has no data.list: $product_list_response"
echo "$product_list_response" | grep -Eq '"total"[[:space:]]*:' || fail "public product list API response has no data.total: $product_list_response"
pass 'public product list works through trusted production HTTPS, controller, response envelope and database query path'

customer_service_response="$(curl --fail --silent --show-error \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/api/weapp/customer-service/config")"
customer_service_type=''
if ! customer_service_type="$(printf '%s' "$customer_service_response" | docker exec -i baby-mall-api node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw);
    if (payload?.code !== 0) throw new Error(`code=${payload?.code}`);
    const data = payload?.data;
    if (!data || data.enabled !== true) throw new Error("customer service is disabled");
    const type = String(data.type || "").trim();
    if (!["phone", "wechat", "both"].includes(type)) throw new Error(`invalid type=${type || "empty"}`);
    if (type === "phone" || type === "both") {
      const phone = String(data.phone || "").trim();
      if (!/^[0-9+().\-\s]{5,40}$/.test(phone)) throw new Error("phone mode has no usable phone number");
    }
    process.stdout.write(type);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});
')"; then
  fail "production customer service config is not launch-usable: $customer_service_response"
fi
pass "customer service production data is enabled and usable for configured mode ($customer_service_type); native WeChat contact still requires real-device acceptance"

callback_payload='{"id":"runtime-smoke-invalid-signature","event_type":"TRANSACTION.SUCCESS","resource":{"algorithm":"AEAD_AES_256_GCM","ciphertext":"invalid-runtime-smoke","nonce":"invalidnonce"}}'
for callback_path in callback refund-callback; do
  callback_body_file="$(mktemp)"
  callback_status="$(curl --silent --show-error \
    --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
    --output "$callback_body_file" \
    --write-out '%{http_code}' \
    --request POST \
    --header 'Content-Type: application/json' \
    --data "$callback_payload" \
    "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/api/weapp/pay/${callback_path}")"
  callback_response="$(cat "$callback_body_file")"
  rm -f "$callback_body_file"
  [ "$callback_status" = '200' ] || fail "${callback_path} route returned HTTP $callback_status instead of 200: $callback_response"
  echo "$callback_response" | grep -Eq '"code"[[:space:]]*:[[:space:]]*"FAIL"' || fail "${callback_path} invalid-signature smoke did not reach callback failure contract: $callback_response"
done
pass 'payment and refund callback routes are reachable through trusted production HTTPS and reject invalid signatures safely'

admin_html="$(curl --fail --silent --show-error \
  --resolve "${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}/")"
echo "$admin_html" | grep -Eqi '<!doctype html|<html' || fail 'admin virtual host did not return the SPA entry page'
pass 'trusted HTTPS admin virtual host serves the SPA'

admin_captcha_response="$(curl --fail --silent --show-error \
  --resolve "${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}/api/admin/auth/captcha")"
echo "$admin_captcha_response" | grep -Eq '"code"[[:space:]]*:[[:space:]]*0' || fail "admin captcha API did not return code=0: $admin_captcha_response"
echo "$admin_captcha_response" | grep -Eq '"captchaId"[[:space:]]*:[[:space:]]*"captcha:' || fail "admin captcha API response has no valid captchaId: $admin_captcha_response"
echo "$admin_captcha_response" | grep -Eq '"captchaSvg"[[:space:]]*:[[:space:]]*"' || fail "admin captcha API response has no captchaSvg: $admin_captcha_response"
pass 'admin trusted HTTPS host reaches the real captcha controller and Redis-backed auth path'

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

public_smoke_name="runtime-smoke-${api_build_sha}.txt"
public_smoke_body="baby-mall-public-upload-${api_build_sha}"
docker exec baby-mall-api sh -c 'mkdir -p /app/apps/api/uploads/public'
docker exec -i baby-mall-api sh -c "cat > /app/apps/api/uploads/public/${public_smoke_name}" <<< "$public_smoke_body"
cleanup_public_smoke() {
  docker exec baby-mall-api rm -f "/app/apps/api/uploads/public/${public_smoke_name}" >/dev/null 2>&1 || true
}
trap cleanup_public_smoke EXIT
served_public_smoke="$(curl --fail --silent --show-error \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/uploads/public/${public_smoke_name}")"
[ "$served_public_smoke" = "$public_smoke_body" ] || fail "public upload shared-volume response mismatch: expected=$public_smoke_body actual=$served_public_smoke"
cleanup_public_smoke
trap - EXIT
pass 'public upload volume written by API is served byte-for-byte through trusted production HTTPS Nginx'

private_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --resolve "${API_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${API_DOMAIN}:${HTTPS_HOST_PORT}/uploads/private/runtime-smoke")"
[ "$private_status" = '403' ] || fail "private upload path returned HTTP $private_status instead of 403"
pass 'private uploads are blocked by Nginx over trusted HTTPS'

image_hash="$(docker exec baby-mall-api cat /app/admin-dist/.build-hash 2>/dev/null | tr -d '\r\n' || true)"
served_hash="$(curl --fail --silent --show-error \
  --resolve "${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}:127.0.0.1" \
  "https://${ADMIN_DOMAIN}:${HTTPS_HOST_PORT}/.build-hash" | tr -d '\r\n')"
[ -n "$image_hash" ] || fail 'API image does not contain /app/admin-dist/.build-hash'
[ "$image_hash" = "$served_hash" ] || fail "admin build hash mismatch: image=$image_hash served=$served_hash"
[ "$image_hash" = "$api_build_sha" ] || fail "API/admin build identity mismatch: api=$api_build_sha admin=$image_hash"
[[ "$served_hash" =~ ^[0-9a-fA-F]{40}$ ]] || fail "admin build hash must be the exact 40-character Git commit SHA: ${served_hash:-empty}"
pass "API and admin static volume match image build $served_hash"

printf 'RUNTIME SMOKE PASS (%d checks)\n' "$PASS_COUNT"
