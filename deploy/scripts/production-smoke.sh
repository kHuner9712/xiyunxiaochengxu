#!/usr/bin/env bash
set -Eeuo pipefail

API_BASE_URL="${API_BASE_URL:-https://api.yunxixiaochengxu.com.cn/api}"
API_URL="${API_URL:-${API_BASE_URL}/health}"
ADMIN_URL="${ADMIN_URL:-https://admin.yunxixiaochengxu.com.cn/}"
API_HOST="${API_HOST:-api.yunxixiaochengxu.com.cn}"
ADMIN_HOST="${ADMIN_HOST:-admin.yunxixiaochengxu.com.cn}"
CERT_MIN_DAYS="${CERT_MIN_DAYS:-21}"

if ! [[ "$CERT_MIN_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "[smoke] CERT_MIN_DAYS 必须为正整数，当前值: $CERT_MIN_DAYS" >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl_common=(
  --fail
  --silent
  --show-error
  --location
  --connect-timeout 10
  --max-time 25
  --retry 2
  --retry-delay 2
  --retry-all-errors
)

echo "[smoke] 检查 API 健康状态: $API_URL"
curl "${curl_common[@]}" "$API_URL" > "$TMP_DIR/health.json"
python3 - "$TMP_DIR/health.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding='utf-8') as file:
    payload = json.load(file)

if payload.get('status') != 'ok':
    raise SystemExit(f"API health status is not ok: {payload!r}")

services = payload.get('services') or {}
unhealthy = {name: status for name, status in services.items() if status != 'ok'}
if unhealthy:
    raise SystemExit(f"API dependencies are unhealthy: {unhealthy!r}")

print(f"[smoke] API 正常，依赖状态: {services}")
PY

check_business_api() {
  local label="$1"
  local path="$2"
  local output="$TMP_DIR/business-${label}.json"
  local url="${API_BASE_URL}${path}"

  echo "[smoke] 检查业务 API ${label}: ${url}"
  curl "${curl_common[@]}" -H 'Accept: application/json' "$url" > "$output"
  python3 - "$output" "$label" <<'PY'
import json
import sys

path, label = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as file:
    payload = json.load(file)

if not isinstance(payload, dict):
    raise SystemExit(f"{label}: response is not a JSON object: {type(payload).__name__}")
if payload.get('code') != 0:
    raise SystemExit(f"{label}: business code is not 0: {payload!r}")
if 'data' not in payload:
    raise SystemExit(f"{label}: response is missing data: {payload!r}")
if not payload.get('requestId'):
    raise SystemExit(f"{label}: response is missing requestId: {payload!r}")

print(f"[smoke] {label} 正常")
PY
}

# These are real public mini-program read paths, not synthetic health endpoints. They exercise
# routing, auth-public metadata, Prisma connectivity/migrations, response serialization and the
# production database schema while remaining safe and side-effect free.
check_business_api "home" "/weapp/home/data"
check_business_api "category" "/weapp/category/tree"
check_business_api "product-list" "/weapp/product/list?page=1&pageSize=1"
check_business_api "activity-feed" "/weapp/activity/feed?tab=recommend&page=1&pageSize=1"
check_business_api "flash-sale-list" "/weapp/flash-sale/list?page=1&pageSize=1"
check_business_api "group-buy-list" "/weapp/group-buy/list?page=1&pageSize=1"
check_business_api "benefit-package-list" "/weapp/benefit-package/list?page=1&pageSize=1"

echo "[smoke] 检查管理后台: $ADMIN_URL"
curl "${curl_common[@]}" --output /dev/null "$ADMIN_URL"
echo "[smoke] 管理后台正常"

check_certificate() {
  local host="$1"
  local cert_file="$TMP_DIR/${host}.pem"
  local min_seconds=$((CERT_MIN_DAYS * 86400))

  echo "[smoke] 检查证书: $host（至少剩余 ${CERT_MIN_DAYS} 天）"
  if ! openssl s_client -connect "${host}:443" -servername "$host" </dev/null 2>/dev/null \
    | openssl x509 -outform PEM > "$cert_file"; then
    echo "[smoke] 无法读取 $host 的 TLS 证书" >&2
    return 1
  fi

  openssl x509 -in "$cert_file" -noout -subject -issuer -dates
  if ! openssl x509 -in "$cert_file" -checkend "$min_seconds" -noout; then
    echo "[smoke] $host 的证书将在 ${CERT_MIN_DAYS} 天内到期" >&2
    return 1
  fi

  echo "[smoke] $host 证书有效期充足"
}

check_certificate "$API_HOST"
check_certificate "$ADMIN_HOST"

echo "[smoke] 生产环境烟雾检查全部通过"
