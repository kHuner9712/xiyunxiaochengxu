#!/bin/bash

# 禧孕母婴商城 后台登录冒烟测试脚本
# 验证后台登录功能是否正常

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

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  禧孕母婴商城 后台登录冒烟测试${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""

all_passed=true

# 1. 获取验证码
echo -e "${COLOR_YELLOW}[1/3] 获取验证码...${COLOR_RESET}"

captcha_response=$(curl -s "${API_BASE}/api/admin/auth/captcha")

if echo "$captcha_response" | grep -q 'captchaId'; then
    echo -e "${COLOR_GREEN}✅  获取验证码成功${COLOR_RESET}"
    captcha_id=$(echo "$captcha_response" | grep -o '"captchaId":"[^"]*"' | cut -d'"' -f4)
    captcha_svg=$(echo "$captcha_response" | grep -o '"captchaSvg":"[^"]*"' | cut -d'"' -f4)
    echo -e "${COLOR_GREEN}    Captcha ID: ${captcha_id}${COLOR_RESET}"
else
    echo -e "${COLOR_RED}❌  获取验证码失败${COLOR_RESET}"
    echo -e "${COLOR_RED}    响应: ${captcha_response}${COLOR_RESET}"
    all_passed=false
fi
echo ""

# 2. 尝试登录
echo -e "${COLOR_YELLOW}[2/3] 管理员登录...${COLOR_RESET}"

login_payload="{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"captchaId\":\"smoke-test\",\"captchaCode\":\"bypass\"}"
login_response=$(curl -s -X POST "${API_BASE}/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "$login_payload")

if echo "$login_response" | grep -q '"accessToken"'; then
    echo -e "${COLOR_GREEN}✅  登录成功${COLOR_RESET}"
    access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    refresh_token=$(echo "$login_response" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
    echo -e "${COLOR_GREEN}    Access Token: ${access_token:0:50}...${COLOR_RESET}"
    echo -e "${COLOR_GREEN}    Refresh Token: ${refresh_token:0:50}...${COLOR_RESET}"
else
    echo -e "${COLOR_RED}❌  登录失败${COLOR_RESET}"
    echo -e "${COLOR_RED}    响应: ${login_response}${COLOR_RESET}"
    all_passed=false
fi
echo ""

# 3. 验证获取用户信息
echo -e "${COLOR_YELLOW}[3/3] 验证获取用户信息...${COLOR_RESET}"

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
        all_passed=false
    fi
else
    echo -e "${COLOR_YELLOW}⚠️  跳过用户信息验证（未获取到 access token）${COLOR_RESET}"
fi
echo ""

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
    exit 1
fi
