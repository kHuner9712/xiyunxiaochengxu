#!/bin/bash
set -e

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_DIR}/.env.production}"

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  禧孕母婴商城 预生产部署${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""

echo -e "${COLOR_YELLOW}[1/7] 检查环境配置...${COLOR_RESET}"
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${COLOR_RED}FAIL${COLOR_RESET} 环境配置文件不存在: $ENV_FILE"
  echo -e "${COLOR_RED}       请复制 .env.example 并填写真实值: cp .env.example .env.production${COLOR_RESET}"
  exit 1
fi
echo -e "${COLOR_GREEN}PASS${COLOR_RESET} 环境配置文件: $ENV_FILE"
echo ""

echo -e "${COLOR_YELLOW}[2/7] 拉取最新代码...${COLOR_RESET}"
cd "$PROJECT_DIR"
git pull origin main
echo ""

echo -e "${COLOR_YELLOW}[3/7] 验证 Docker Compose 配置...${COLOR_RESET}"
cd "$DEPLOY_DIR"
if ! docker compose --env-file "$ENV_FILE" config > /dev/null 2>&1; then
  echo -e "${COLOR_RED}FAIL${COLOR_RESET} Docker Compose 配置验证失败"
  docker compose --env-file "$ENV_FILE" config 2>&1 | tail -10
  exit 1
fi
echo -e "${COLOR_GREEN}PASS${COLOR_RESET} Docker Compose 配置验证通过"
echo ""

echo -e "${COLOR_YELLOW}[4/7] 停止旧容器...${COLOR_RESET}"
cd "$DEPLOY_DIR"
docker compose down 2>/dev/null || true
echo ""

echo -e "${COLOR_YELLOW}[5/7] 构建并启动容器...${COLOR_RESET}"
cd "$DEPLOY_DIR"
docker compose --env-file "$ENV_FILE" up -d --build
echo ""

echo -e "${COLOR_YELLOW}[6/7] 等待服务就绪...${COLOR_RESET}"
echo "等待 MySQL 启动..."
sleep 15
echo ""

echo -e "${COLOR_YELLOW}[7/7] 验证部署...${COLOR_RESET}"
API_HEALTH_URL="http://localhost:3001/api/health"
MAX_RETRIES=30
RETRY_INTERVAL=2
api_healthy=false

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$API_HEALTH_URL" > /dev/null 2>&1; then
    api_healthy=true
    break
  fi
  echo "  等待 API 就绪 ($i/$MAX_RETRIES)..."
  sleep $RETRY_INTERVAL
done

if [ "$api_healthy" = true ]; then
  echo -e "${COLOR_GREEN}PASS${COLOR_RESET} API health check 通过"
else
  echo -e "${COLOR_RED}FAIL${COLOR_RESET} API health check 失败"
  echo -e "${COLOR_RED}       排查: cd deploy && docker compose logs api${COLOR_RESET}"
  exit 1
fi
echo ""

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}  预生产部署完成！${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""
echo -e "  API:     ${COLOR_GREEN}https://api.yunxixiaochengxu.com.cn/api${COLOR_RESET}"
echo -e "  Admin:   ${COLOR_GREEN}https://admin.yunxixiaochengxu.com.cn${COLOR_RESET}"
echo -e "  Health:  ${COLOR_GREEN}https://api.yunxixiaochengxu.com.cn/api/health${COLOR_RESET}"
echo ""
echo -e "${COLOR_YELLOW}后续步骤:${COLOR_RESET}"
echo -e "  1. 执行冒烟测试:"
echo -e "     ${COLOR_BLUE}BASE_URL=https://api.yunxixiaochengxu.com.cn bash deploy/scripts/smoke-preprod.sh${COLOR_RESET}"
echo -e "  2. 访问管理后台:"
echo -e "     ${COLOR_BLUE}https://admin.yunxixiaochengxu.com.cn${COLOR_RESET}"
echo -e "  3. 上传小程序体验版并真机验收"
echo ""
