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

echo -e "${COLOR_YELLOW}[4] 支付路由可达性测试${COLOR_RESET}"
check_status "Pay callback route exists" "GET" "/api/weapp/pay/callback" "not_404"
check_status "Refund callback route exists" "GET" "/api/weapp/pay/refund-callback" "not_404"
echo ""

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "  总计: ${COLOR_GREEN}${PASS_COUNT} PASS${COLOR_RESET} / ${COLOR_RED}${FAIL_COUNT} FAIL${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
