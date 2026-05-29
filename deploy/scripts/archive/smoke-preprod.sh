#!/bin/bash
set -e

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"

BASE_URL="${BASE_URL:-http://localhost:80}"
TEST_ADMIN_USERNAME="${TEST_ADMIN_USERNAME:-}"
TEST_ADMIN_PASSWORD="${TEST_ADMIN_PASSWORD:-}"

PASS_COUNT=0
FAIL_COUNT=0
MANUAL_COUNT=0

check_status() {
  local desc="$1"
  local method="$2"
  local path="$3"
  local expected="$4"

  local url="${BASE_URL}${path}"
  local status

  if [ "$method" = "GET" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  elif [ "$method" = "POST" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$url" 2>/dev/null || echo "000")
  fi

  if [ "$expected" = "not_404" ]; then
    if [ "$status" != "404" ]; then
      echo -e "${COLOR_GREEN}PASS${COLOR_RESET} [$status] $desc"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "${COLOR_RED}FAIL${COLOR_RESET} [$status] $desc (expected not 404)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    if [ "$status" = "$expected" ]; then
      echo -e "${COLOR_GREEN}PASS${COLOR_RESET} [$status] $desc"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "${COLOR_RED}FAIL${COLOR_RESET} [$status] $desc (expected $expected)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
}

manual() {
  MANUAL_COUNT=$((MANUAL_COUNT + 1))
  echo -e "${COLOR_YELLOW}MANUAL${COLOR_RESET} $1"
}

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  禧孕母婴商城 预生产冒烟测试${COLOR_RESET}"
echo -e "${COLOR_BLUE}  BASE_URL: $BASE_URL${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""

echo -e "${COLOR_YELLOW}[1] 基础端点测试${COLOR_RESET}"
check_status "Health check" "GET" "/api/health" "200"
check_status "Home page" "GET" "/api/weapp/home" "200"
check_status "Product list" "GET" "/api/weapp/product/list" "200"
check_status "Activity feed (recommend)" "GET" "/api/weapp/activity/feed?tab=recommend" "200"
check_status "Activity feed (video)" "GET" "/api/weapp/activity/feed?tab=video" "200"
check_status "Content list" "GET" "/api/weapp/content/list?placement=activity" "200"
check_status "Pickup store list" "GET" "/api/weapp/pickup-store/list" "200"
check_status "Customer service config" "GET" "/api/weapp/customer-service/config" "200"
echo ""

echo -e "${COLOR_YELLOW}[2] 权限边界测试${COLOR_RESET}"
check_status "Share visit (public endpoint)" "POST" "/api/weapp/share/visit" "not_404"
check_status "User info (auth required, expect 401)" "GET" "/api/weapp/user/info" "401"
echo ""

echo -e "${COLOR_YELLOW}[3] 后台可达性测试${COLOR_RESET}"
if [ -n "$TEST_ADMIN_USERNAME" ] && [ -n "$TEST_ADMIN_PASSWORD" ]; then
  login_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_ADMIN_USERNAME\",\"password\":\"$TEST_ADMIN_PASSWORD\"}" \
    "${BASE_URL}/api/admin/auth/login" 2>/dev/null || echo "000")
  if [ "$login_status" = "200" ] || [ "$login_status" = "201" ]; then
    echo -e "${COLOR_GREEN}PASS${COLOR_RESET} [$login_status] Admin login (with credentials)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${COLOR_RED}FAIL${COLOR_RESET} [$login_status] Admin login (expected 200/201)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  check_status "Admin login endpoint reachable" "POST" "/api/admin/auth/login" "not_404"
fi
echo ""

echo -e "${COLOR_YELLOW}[4] 支付/退款回调配置检查${COLOR_RESET}"
if [ -n "${WECHAT_NOTIFY_URL:-}" ]; then
  if [[ "${WECHAT_NOTIFY_URL}" == https://* ]]; then
    echo -e "${COLOR_GREEN}PASS${COLOR_RESET} WECHAT_NOTIFY_URL 已配置: ${WECHAT_NOTIFY_URL}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${COLOR_RED}FAIL${COLOR_RESET} WECHAT_NOTIFY_URL 非 HTTPS: ${WECHAT_NOTIFY_URL}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  manual "WECHAT_NOTIFY_URL 未配置，支付回调需通过微信真实回调或专项测试验证"
fi
if [ -n "${WECHAT_REFUND_NOTIFY_URL:-}" ]; then
  if [[ "${WECHAT_REFUND_NOTIFY_URL}" == https://* ]]; then
    echo -e "${COLOR_GREEN}PASS${COLOR_RESET} WECHAT_REFUND_NOTIFY_URL 已配置: ${WECHAT_REFUND_NOTIFY_URL}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${COLOR_RED}FAIL${COLOR_RESET} WECHAT_REFUND_NOTIFY_URL 非 HTTPS: ${WECHAT_REFUND_NOTIFY_URL}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  manual "WECHAT_REFUND_NOTIFY_URL 未配置，退款回调需通过微信真实回调或专项测试验证"
fi
echo ""

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "  总计: ${COLOR_GREEN}${PASS_COUNT} PASS${COLOR_RESET} / ${COLOR_RED}${FAIL_COUNT} FAIL${COLOR_RESET} / ${COLOR_YELLOW}${MANUAL_COUNT} MANUAL${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
echo ""
echo -e "${COLOR_YELLOW}提示: MANUAL 项需通过微信真实回调或专项测试验证，不阻止部署${COLOR_RESET}"
exit 0
