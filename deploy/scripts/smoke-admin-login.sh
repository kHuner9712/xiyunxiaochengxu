#!/usr/bin/env bash
set -Eeuo pipefail

API_BASE_URL="${API_BASE_URL:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
LOGIN_MODE="${LOGIN_MODE:-manual}"
NODE_ENV_VALUE="${NODE_ENV:-development}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v node >/dev/null 2>&1 || fail "node is required"

[ -n "$API_BASE_URL" ] || fail "API_BASE_URL is required; do not rely on a localhost production default"
[ -n "$ADMIN_USERNAME" ] || fail "ADMIN_USERNAME is required; no default admin account is assumed"
[ -n "$ADMIN_PASSWORD" ] || fail "ADMIN_PASSWORD is required; no default password is allowed"
API_BASE_URL="${API_BASE_URL%/}"

if [ "$NODE_ENV_VALUE" = "production" ]; then
  [ "$API_BASE_URL" = "https://api.yunxixiaochengxu.com.cn" ] \
    || fail "production login smoke must use https://api.yunxixiaochengxu.com.cn"
  [ "$LOGIN_MODE" = "manual" ] \
    || fail "production login smoke forbids captcha bypass; use LOGIN_MODE=manual with a real captcha"
fi

case "$LOGIN_MODE" in
  manual)
    CAPTCHA_ID="${CAPTCHA_ID:-}"
    CAPTCHA_CODE="${CAPTCHA_CODE:-}"
    if [ -z "$CAPTCHA_ID" ] || [ -z "$CAPTCHA_CODE" ]; then
      fail "manual mode requires CAPTCHA_ID and CAPTCHA_CODE from GET ${API_BASE_URL}/api/admin/auth/captcha"
    fi
    ;;
  bypass)
    [ "$NODE_ENV_VALUE" != "production" ] || fail "captcha bypass is forbidden in production"
    [ "${SMOKE_TEST_BYPASS_CAPTCHA:-false}" = "true" ] \
      || fail "bypass mode requires SMOKE_TEST_BYPASS_CAPTCHA=true and is non-production only"
    CAPTCHA_ID="smoke-test"
    CAPTCHA_CODE="bypass"
    ;;
  *)
    fail "LOGIN_MODE must be manual or bypass"
    ;;
esac

login_payload="$({
  ADMIN_USERNAME="$ADMIN_USERNAME" \
  ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  CAPTCHA_ID="$CAPTCHA_ID" \
  CAPTCHA_CODE="$CAPTCHA_CODE" \
  node -e '
    process.stdout.write(JSON.stringify({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
      captchaId: process.env.CAPTCHA_ID,
      captchaCode: process.env.CAPTCHA_CODE,
    }));
  '
})"

login_response="$(curl --silent --show-error \
  -X POST "${API_BASE_URL}/api/admin/auth/login" \
  -H 'Content-Type: application/json' \
  --data-binary "$login_payload")"

access_token="$({
  RESPONSE="$login_response" node -e '
    try {
      const body = JSON.parse(process.env.RESPONSE || "{}");
      const data = body?.data ?? body;
      process.stdout.write(typeof data?.accessToken === "string" ? data.accessToken : "");
    } catch { process.exit(1); }
  '
})" || fail "login response is not valid JSON"
refresh_token="$({
  RESPONSE="$login_response" node -e '
    const body = JSON.parse(process.env.RESPONSE || "{}");
    const data = body?.data ?? body;
    process.stdout.write(typeof data?.refreshToken === "string" ? data.refreshToken : "");
  '
})"

[ -n "$access_token" ] || fail "admin login did not return accessToken"
[ -n "$refresh_token" ] || fail "admin login did not return refreshToken"
pass "admin login returned access and refresh tokens"

info_response="$(curl --silent --show-error \
  "${API_BASE_URL}/api/admin/auth/info" \
  -H "Authorization: Bearer ${access_token}")"
RESPONSE="$info_response" node -e '
  const body = JSON.parse(process.env.RESPONSE || "{}");
  const data = body?.data ?? body;
  if (data?.id === undefined || data?.id === null || !data?.username) process.exit(1);
' || fail "authenticated admin info endpoint did not return an admin identity"
pass "authenticated admin info endpoint is usable"

refresh_payload="$({
  REFRESH_TOKEN="$refresh_token" node -e '
    process.stdout.write(JSON.stringify({ refreshToken: process.env.REFRESH_TOKEN }));
  '
})"
refresh_response="$(curl --silent --show-error \
  -X POST "${API_BASE_URL}/api/admin/auth/refresh" \
  -H 'Content-Type: application/json' \
  --data-binary "$refresh_payload")"
new_access_token="$({
  RESPONSE="$refresh_response" node -e '
    try {
      const body = JSON.parse(process.env.RESPONSE || "{}");
      const data = body?.data ?? body;
      process.stdout.write(typeof data?.accessToken === "string" ? data.accessToken : "");
    } catch { process.exit(1); }
  '
})" || fail "refresh response is not valid JSON"
[ -n "$new_access_token" ] || fail "refresh token flow did not return a new accessToken"
pass "admin refresh token flow is usable"

echo "Admin login smoke completed successfully."
