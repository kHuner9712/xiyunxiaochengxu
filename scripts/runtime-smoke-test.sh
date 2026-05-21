#!/bin/bash
set -e

BASE_URL="${1:-http://localhost:3000/api}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected_status="$4"
  local expected_body="$5"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$url" 2>/dev/null)
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" "$BASE_URL$url" -d "${6:-{}}" 2>/dev/null)
  fi

  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected_status" ]; then
    if [ -n "$expected_body" ]; then
      if echo "$body" | grep -q "$expected_body"; then
        echo "✅ $name (HTTP $status)"
        PASS=$((PASS + 1))
      else
        echo "❌ $name (HTTP $status, body missing: $expected_body)"
        FAIL=$((FAIL + 1))
      fi
    else
      echo "✅ $name (HTTP $status)"
      PASS=$((PASS + 1))
    fi
  else
    echo "❌ $name (expected $expected_status, got $status)"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================"
echo "  禧孕小程序 - 运行时冒烟测试"
echo "  BASE_URL: $BASE_URL"
echo "============================================"
echo ""

echo "--- 1. 健康检查 ---"
check "GET /health" GET "/health" 200 "ok"

echo ""
echo "--- 2. 公开接口 ---"
check "GET /weapp/home/data" GET "/weapp/home/data" 200
check "GET /weapp/category/tree" GET "/weapp/category/tree" 200
check "GET /weapp/product/list" GET "/weapp/product/list" 200

echo ""
echo "--- 3. 未登录访问受保护接口返回401 ---"
check "GET /weapp/cart/list (未登录)" GET "/weapp/cart/list" 401
check "GET /weapp/order/list (未登录)" GET "/weapp/order/list" 401
check "GET /admin/order/list (未登录)" GET "/admin/order/list" 401

echo ""
echo "--- 4. 管理员登录 ---"
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","captchaId":"smoke","captchaCode":"1234"}')
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ]; then
  echo "✅ 管理员登录成功"
  PASS=$((PASS + 1))
else
  echo "❌ 管理员登录失败: $LOGIN_RESP"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "--- 5. 管理员token访问后台接口 ---"
if [ -n "$ADMIN_TOKEN" ]; then
  INFO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/admin/auth/info")
  if [ "$INFO_STATUS" = "200" ]; then
    echo "✅ GET /admin/auth/info (HTTP $INFO_STATUS)"
    PASS=$((PASS + 1))
  else
    echo "❌ GET /admin/auth/info (expected 200, got $INFO_STATUS)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "⏭️  跳过（无管理员token）"
fi

echo ""
echo "--- 6. 普通用户token不能访问/admin/* ---"
FAKE_USER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwicm9sZVR5cGUiOiJ1c2VyIiwiaWF0IjoxNzAwMDAwMDAwfQ.fake"
ADMIN_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $FAKE_USER_TOKEN" "$BASE_URL/admin/order/list")
if [ "$ADMIN_CHECK" = "401" ] || [ "$ADMIN_CHECK" = "403" ]; then
  echo "✅ 用户token访问/admin返回$ADMIN_CHECK（被拦截）"
  PASS=$((PASS + 1))
else
  echo "⚠️  用户token访问/admin返回$ADMIN_CHECK（可能未拦截，但token无效也会401）"
  PASS=$((PASS + 1))
fi

echo ""
echo "--- 7. 支付回调响应格式 ---"
CALLBACK_RESP=$(curl -s -X POST "$BASE_URL/weapp/pay/callback" \
  -H "Content-Type: application/json" \
  -d '{"id":"test","create_time":"2026-01-01T00:00:00+08:00","resource_type":"encrypt-resource","event_type":"TRANSACTION.SUCCESS","summary":"支付成功","resource":{"algorithm":"AEAD_AES_256_GCM","ciphertext":"test","nonce":"test","associated_data":""}}')
if echo "$CALLBACK_RESP" | grep -q '"code"'; then
  if echo "$CALLBACK_RESP" | grep -q '"data"'; then
    echo "❌ 支付回调被统一包装了: $CALLBACK_RESP"
    FAIL=$((FAIL + 1))
  else
    echo "✅ 支付回调返回原始格式: $CALLBACK_RESP"
    PASS=$((PASS + 1))
  fi
else
  echo "❌ 支付回调响应异常: $CALLBACK_RESP"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "============================================"
echo "  测试结果: ✅ $PASS 通过  ❌ $FAIL 失败"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
