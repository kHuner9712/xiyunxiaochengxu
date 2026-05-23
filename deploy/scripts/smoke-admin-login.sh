#!/bin/bash

# 禧孕母婴商城 后台登录冒烟测试脚本
# 验证后台登录功能是否正常
#
# 两种模式:
#   1. bypass 模式 (默认): 需要 SMOKE_TEST_BYPASS_CAPTCHA=true，自动绕过验证码
#   2. manual 模式: 需要手动提供 captchaId 和 captchaCode

set -e

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"

API_PORT=${API_PORT:-3001}
API_BASE="http://localhost:${API_PORT}"
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
LOGIN_MODE=${LOGIN_MODE:-bypass}

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  禧孕母婴商城 后台登录冒烟测试${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""

# -------------------------------------------------------
# 0. 依赖检查
# -------------------------------------------------------
echo -e "${COLOR_YELLOW}[0/3] 检查运行依赖...${COLOR_RESET}"

if ! command -v curl > /dev/null 2>&1; then
    echo -e "${COLOR_RED}❌  curl 未安装，无法继续${COLOR_RESET}"
    exit 1
else
    echo -e "${COLOR_GREEN}✅  curl 已安装${COLOR_RESET}"
fi

echo ""

all_passed=true

# -------------------------------------------------------
# 1. 登录
# -------------------------------------------------------
echo -e "${COLOR_YELLOW}[1/3] 管理员登录 (模式: $LOGIN_MODE)...${COLOR_RESET}"

if [ "$LOGIN_MODE" = "bypass" ]; then
    # bypass 模式: 检查 SMOKE_TEST_BYPASS_CAPTCHA 环境变量
    BYPASS_CAPTCHA="${SMOKE_TEST_BYPASS_CAPTCHA:-false}"

    if [ "$BYPASS_CAPTCHA" != "true" ]; then
        echo -e "${COLOR_RED}❌  bypass 模式需要设置 SMOKE_TEST_BYPASS_CAPTCHA=true${COLOR_RESET}"
        echo -e "${COLOR_RED}    此选项仅限非生产环境使用!${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}    提示: 在 .env 文件中添加 SMOKE_TEST_BYPASS_CAPTCHA=true${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}    提示: 或使用 manual 模式: LOGIN_MODE=manual CAPTCHA_ID=xxx CAPTCHA_CODE=xxx $0${COLOR_RESET}"
        all_passed=false
    else
        echo -e "${COLOR_YELLOW}    使用 bypass 绕过验证码 (仅限非生产环境)${COLOR_RESET}"
        login_payload="{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"captchaId\":\"smoke-test\",\"captchaCode\":\"bypass\"}"
        login_response=$(curl -s -X POST "${API_BASE}/api/admin/auth/login" \
            -H "Content-Type: application/json" \
            -d "$login_payload")

        if echo "$login_response" | grep -q '"accessToken"'; then
            echo -e "${COLOR_GREEN}✅  登录成功 (bypass 模式)${COLOR_RESET}"
            access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
            refresh_token=$(echo "$login_response" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
            echo -e "${COLOR_GREEN}    Access Token: ${access_token:0:50}...${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}❌  登录失败${COLOR_RESET}"
            echo -e "${COLOR_RED}    响应: ${login_response}${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: 确认 ADMIN_USERNAME / ADMIN_PASSWORD 是否正确${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: 确认种子数据已加载 (RUN_SEED=true)${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: cd deploy && docker compose logs api${COLOR_RESET}"
            all_passed=false
        fi
    fi

elif [ "$LOGIN_MODE" = "manual" ]; then
    # manual 模式: 需要提供 CAPTCHA_ID 和 CAPTCHA_CODE
    CAPTCHA_ID="${CAPTCHA_ID:-}"
    CAPTCHA_CODE="${CAPTCHA_CODE:-}"

    if [ -z "$CAPTCHA_ID" ] || [ -z "$CAPTCHA_CODE" ]; then
        echo -e "${COLOR_YELLOW}    manual 模式需要先获取验证码...${COLOR_RESET}"
        captcha_response=$(curl -s "${API_BASE}/api/admin/auth/captcha")

        if echo "$captcha_response" | grep -q 'captchaId'; then
            captcha_id_val=$(echo "$captcha_response" | grep -o '"captchaId":"[^"]*"' | cut -d'"' -f4)
            echo -e "${COLOR_GREEN}    Captcha ID: ${captcha_id_val}${COLOR_RESET}"
            echo -e "${COLOR_YELLOW}    请查看验证码图片并输入验证码 (SVG 已在 API 响应中返回)${COLOR_RESET}"
            echo -e "${COLOR_YELLOW}    然后运行:${COLOR_RESET}"
            echo -e "      CAPTCHA_ID=${captcha_id_val} CAPTCHA_CODE=<输入的验证码> LOGIN_MODE=manual $0"
            echo ""
            exit 0
        else
            echo -e "${COLOR_RED}❌  获取验证码失败${COLOR_RESET}"
            echo -e "${COLOR_RED}    响应: ${captcha_response}${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: cd deploy && docker compose logs api${COLOR_RESET}"
            all_passed=false
        fi
    else
        echo -e "${COLOR_YELLOW}    使用 manual 验证码模式${COLOR_RESET}"
        login_payload="{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"captchaId\":\"${CAPTCHA_ID}\",\"captchaCode\":\"${CAPTCHA_CODE}\"}"
        login_response=$(curl -s -X POST "${API_BASE}/api/admin/auth/login" \
            -H "Content-Type: application/json" \
            -d "$login_payload")

        if echo "$login_response" | grep -q '"accessToken"'; then
            echo -e "${COLOR_GREEN}✅  登录成功 (manual 模式)${COLOR_RESET}"
            access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
            refresh_token=$(echo "$login_response" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
            echo -e "${COLOR_GREEN}    Access Token: ${access_token:0:50}...${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}❌  登录失败${COLOR_RESET}"
            echo -e "${COLOR_RED}    响应: ${login_response}${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: 验证码可能已过期，请重新获取${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: 确认 ADMIN_USERNAME / ADMIN_PASSWORD 是否正确${COLOR_RESET}"
            echo -e "${COLOR_RED}    排查: cd deploy && docker compose logs api${COLOR_RESET}"
            all_passed=false
        fi
    fi

else
    echo -e "${COLOR_RED}❌  未知 LOGIN_MODE: $LOGIN_MODE (支持: bypass, manual)${COLOR_RESET}"
    all_passed=false
fi

echo ""

# -------------------------------------------------------
# 2. 验证获取用户信息
# -------------------------------------------------------
echo -e "${COLOR_YELLOW}[2/3] 验证获取用户信息...${COLOR_RESET}"

if [ -n "$access_token" ]; then
    info_response=$(curl -s "${API_BASE}/api/admin/auth/info" \
        -H "Authorization: Bearer ${access_token}")

    if echo "$info_response" | grep -q '"id"'; then
        echo -e "${COLOR_GREEN}✅  获取用户信息成功${COLOR_RESET}"
        username=$(echo "$info_response" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        echo -e "${COLOR_GREEN}    用户名: ${username}${COLOR_RESET}"
        if echo "$info_response" | grep -q '"roles"'; then
            roles=$(echo "$info_response" | grep -o '"roles":\[[^]]*\]' | cut -d'[' -f2 | cut -d']' -f1)
            echo -e "${COLOR_GREEN}    角色: ${roles}${COLOR_RESET}"
        fi
    else
        echo -e "${COLOR_RED}❌  获取用户信息失败${COLOR_RESET}"
        echo -e "${COLOR_RED}    响应: ${info_response}${COLOR_RESET}"
        echo -e "${COLOR_RED}    排查: cd deploy && docker compose logs api${COLOR_RESET}"
        all_passed=false
    fi
else
    echo -e "${COLOR_YELLOW}⚠️  跳过用户信息验证（未获取到 access token）${COLOR_RESET}"
fi
echo ""

# -------------------------------------------------------
# 3. 验证 Token 刷新
# -------------------------------------------------------
echo -e "${COLOR_YELLOW}[3/3] 验证 Token 刷新...${COLOR_RESET}"

if [ -n "$refresh_token" ]; then
    refresh_response=$(curl -s -X POST "${API_BASE}/api/admin/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refreshToken\":\"${refresh_token}\"}")

    if echo "$refresh_response" | grep -q '"accessToken"'; then
        echo -e "${COLOR_GREEN}✅  Token 刷新成功${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠️  Token 刷新失败 (可能不影响核心功能)${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}    响应: ${refresh_response}${COLOR_RESET}"
    fi
else
    echo -e "${COLOR_YELLOW}⚠️  跳过 Token 刷新验证（未获取到 refresh token）${COLOR_RESET}"
fi
echo ""

# -------------------------------------------------------
# 汇总
# -------------------------------------------------------
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
if [ "$all_passed" = true ]; then
    echo -e "${COLOR_GREEN}  后台登录冒烟测试通过!${COLOR_RESET}"
    echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
    echo ""
    exit 0
else
    echo -e "${COLOR_RED}  后台登录冒烟测试失败!${COLOR_RESET}"
    echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_RED}请根据上述排查提示检查服务状态。${COLOR_RESET}"
    echo ""
    exit 1
fi
