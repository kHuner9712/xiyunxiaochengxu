#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}WARN${NC} $1"; }
info() { echo -e "${CYAN}INFO${NC} $1"; }

API_BASE_URL="${API_BASE_URL:-}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-}"
PAY_NOTIFY_URL="${PAY_NOTIFY_URL:-}"
REFUND_NOTIFY_URL="${REFUND_NOTIFY_URL:-}"
CHECK_SCHEDULER_LOGS="${CHECK_SCHEDULER_LOGS:-true}"
SMOKE_FORBIDDEN_TOKEN="${SMOKE_FORBIDDEN_TOKEN:-}"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_BASE="${TMPDIR:-/tmp}"

if [ -z "$API_BASE_URL" ] || [ -z "$ADMIN_BASE_URL" ]; then
  fail "请先设置 API_BASE_URL 和 ADMIN_BASE_URL，例如：API_BASE_URL=https://api.example.com ADMIN_BASE_URL=https://admin.example.com"
fi

if [[ "$API_BASE_URL" != https://* ]]; then
  fail "API_BASE_URL 必须为 HTTPS URL"
fi
if [[ "$ADMIN_BASE_URL" != https://* ]]; then
  fail "ADMIN_BASE_URL 必须为 HTTPS URL"
fi

if [ -z "$PAY_NOTIFY_URL" ]; then
  PAY_NOTIFY_URL="${API_BASE_URL}/api/weapp/pay/callback"
fi
if [ -z "$REFUND_NOTIFY_URL" ]; then
  REFUND_NOTIFY_URL="${API_BASE_URL}/api/weapp/pay/refund-callback"
fi

if [[ "$PAY_NOTIFY_URL" != https://* ]] || [[ "$REFUND_NOTIFY_URL" != https://* ]]; then
  fail "PAY_NOTIFY_URL / REFUND_NOTIFY_URL 必须为 HTTPS URL"
fi

http_code() {
  local method="$1"
  local url="$2"
  curl -k -s -o /dev/null -w '%{http_code}' -X "$method" "$url" || true
}

assert_http() {
  local name="$1"
  local method="$2"
  local url="$3"
  local regex="$4"
  local code
  code="$(http_code "$method" "$url")"
  if [[ ! "$code" =~ $regex ]]; then
    fail "$name 失败：$url -> HTTP $code"
  fi
  pass "$name 通过：$url -> HTTP $code"
}

assert_business_code() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected="$4"
  local body
  body="$(curl -k -s -X "$method" "$url" -H 'Content-Type: application/json' -d "${5:-}" || true)"
  if echo "$body" | grep -q "\"code\":$expected"; then
    pass "$name 通过：业务 code=$expected"
  else
    fail "$name 失败：期望业务 code=$expected，响应=$body"
  fi
}

info "1) API 健康检查"
assert_http "GET /api/health" "GET" "${API_BASE_URL}/api/health" '^(200)$'

health_body="$(curl -k -s "${API_BASE_URL}/api/health" || true)"
if echo "$health_body" | grep -q '"database":"ok"'; then
  pass "数据库连接状态正常（health 中 database=ok）"
else
  warn "health 未明确返回 database=ok，请检查 API 日志"
fi

info "1.5) API 错误响应与 requestId 检查"
unauth_body="$(curl -k -s -D "$TMP_BASE/smoke-headers-$$.txt" "${API_BASE_URL}/api/weapp/order/count" || true)"
if echo "$unauth_body" | grep -Eq '"code":4010[123]' && grep -qi '^X-Request-Id:' "$TMP_BASE/smoke-headers-$$.txt"; then
  pass "未登录接口返回 401 业务码并带 X-Request-Id"
else
  fail "未登录接口未返回 401 业务码或缺少 X-Request-Id：$unauth_body"
fi
rm -f "$TMP_BASE/smoke-headers-$$.txt"
assert_business_code "参数错误响应" "POST" "${API_BASE_URL}/api/weapp/auth/login" "40001" '{}'
if [ -n "$SMOKE_FORBIDDEN_TOKEN" ]; then
  forbidden_body="$(curl -k -s -H "Authorization: Bearer $SMOKE_FORBIDDEN_TOKEN" "${API_BASE_URL}/api/admin/order/list" || true)"
  if echo "$forbidden_body" | grep -q '"code":40301'; then
    pass "403 权限错误响应通过"
  else
    fail "403 权限错误响应失败：$forbidden_body"
  fi
else
  warn "未提供 SMOKE_FORBIDDEN_TOKEN，跳过 403 权限错误 smoke（建议提供低权限 token）"
fi
if echo "$health_body" | grep -q '"redis":"ok"'; then
  pass "Redis 连接状态正常（health 中 redis=ok）"
else
  warn "health 未明确返回 redis=ok，请检查 API 日志"
fi

info "2) 管理后台可访问性"
assert_http "管理后台首页" "GET" "${ADMIN_BASE_URL}/" '^(200|301|302)$'

info "3) /uploads 静态资源路由"
assert_http "uploads 路由" "GET" "${API_BASE_URL}/uploads/" '^(200|301|302|403|404)$'

info "4) 小程序 API 域名 HTTPS 检查"
if [[ "$API_BASE_URL" == https://* ]]; then
  pass "小程序 API 域名为 HTTPS：$API_BASE_URL"
else
  fail "小程序 API 域名不是 HTTPS：$API_BASE_URL"
fi

info "5) 支付/退款回调 URL 公网可达性（仅连通性）"
assert_http "支付回调 URL 连通性" "POST" "$PAY_NOTIFY_URL" '^(200|204|400|401|403|404|405)$'
assert_http "退款回调 URL 连通性" "POST" "$REFUND_NOTIFY_URL" '^(200|204|400|401|403|404|405)$'

if [ "$CHECK_SCHEDULER_LOGS" = "true" ]; then
  info "6) 定时任务日志检查（需要本机可访问 docker compose）"
  if command -v docker >/dev/null 2>&1; then
    cd "$DEPLOY_DIR"
    recent_logs="$(docker compose logs --since 30m api 2>/dev/null | grep -Ei 'reconcile|schedule|cron|close timeout|refund' | tail -20 || true)"
    if [ -n "$recent_logs" ]; then
      pass "检测到最近 30 分钟内的定时任务相关日志"
    else
      warn "未检测到定时任务关键词日志，请人工核对 docker compose logs api"
    fi
  else
    warn "未安装 docker，跳过定时任务日志检查"
  fi
fi

echo -e "${GREEN}公网 smoke 检查完成${NC}"
