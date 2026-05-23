#!/bin/bash

# 禧孕母婴商城 全量冒烟测试脚本
# 顺序执行 smoke-test.sh 和 smoke-admin-login.sh

set -e

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_BLUE="\033[34m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  禧孕母婴商城 全量冒烟测试${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""

echo -e "${COLOR_BLUE}[阶段 1/2] 基础服务冒烟测试${COLOR_RESET}"
echo ""

if ! bash "${SCRIPT_DIR}/smoke-test.sh"; then
    echo -e "${COLOR_RED}基础服务冒烟测试失败，跳过后台登录测试。${COLOR_RESET}"
    exit 1
fi

echo ""
echo -e "${COLOR_BLUE}[阶段 2/2] 后台登录冒烟测试${COLOR_RESET}"
echo ""

if ! bash "${SCRIPT_DIR}/smoke-admin-login.sh"; then
    echo -e "${COLOR_RED}后台登录冒烟测试失败。${COLOR_RESET}"
    exit 1
fi

echo ""
echo -e "${COLOR_GREEN}============================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}  全量冒烟测试通过!${COLOR_RESET}"
echo -e "${COLOR_GREEN}============================================${COLOR_RESET}"
echo ""
exit 0
