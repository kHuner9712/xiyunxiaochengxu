#!/bin/bash

# 禧孕母婴商城 Docker 部署冒烟测试脚本
# 用于验证部署后的核心功能是否正常

set -e

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"

# 配置
API_PORT=${API_PORT:-3001}
NGINX_PORT=${NGINX_PORT:-8080}
RETRY_MAX=30
RETRY_INTERVAL=2

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}  禧孕母婴商城 冒烟测试开始${COLOR_RESET}"
echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
echo ""

all_passed=true

# 1. 检查 Docker 服务状态
echo -e "${COLOR_YELLOW}[1/5] 检查 Docker Compose 服务状态...${COLOR_RESET}"

cd "$(dirname "$0")/.."
if ! docker compose ps > /dev/null 2>&1; then
    echo -e "${COLOR_RED}❌  Docker Compose 未运行${COLOR_RESET}"
    echo -e "${COLOR_RED}    请运行 'docker compose up -d' 启动服务${COLOR_RESET}"
    all_passed=false
else
    services_running=$(docker compose ps --format json | jq -r '. | select(.State == "running") | .Service' | wc -l)
    if [ "$services_running" -gt 0 ]; then
        echo -e "${COLOR_GREEN}✅  服务运行正常 ($services_running 个服务)${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}❌  没有正在运行的服务${COLOR_RESET}"
        all_passed=false
    fi
fi
echo ""

# 2. 检查 MySQL 健康状态
echo -e "${COLOR_YELLOW}[2/5] 检查 MySQL 健康状态...${COLOR_RESET}"

mysql_healthy=false
for i in $(seq 1 $RETRY_MAX); do
    if docker compose exec -T mysql mysqladmin ping -h localhost -uroot -p"${DB_PASSWORD:-baby_mall_2024}" > /dev/null 2>&1; then
        mysql_healthy=true
        break
    fi
    echo -e "${COLOR_YELLOW}    等待 MySQL 就绪 ($i/$RETRY_MAX)...${COLOR_RESET}"
    sleep $RETRY_INTERVAL
done

if [ "$mysql_healthy" = true ]; then
    echo -e "${COLOR_GREEN}✅  MySQL 健康${COLOR_RESET}"
else
    echo -e "${COLOR_RED}❌  MySQL 健康检查失败${COLOR_RESET}"
    all_passed=false
fi
echo ""

# 3. 检查 Redis 健康状态
echo -e "${COLOR_YELLOW}[3/5] 检查 Redis 健康状态...${COLOR_RESET}"

redis_healthy=false
for i in $(seq 1 $RETRY_MAX); do
    if docker compose exec -T redis redis-cli ping | grep -q "PONG"; then
        redis_healthy=true
        break
    fi
    echo -e "${COLOR_YELLOW}    等待 Redis 就绪 ($i/$RETRY_MAX)...${COLOR_RESET}"
    sleep $RETRY_INTERVAL
done

if [ "$redis_healthy" = true ]; then
    echo -e "${COLOR_GREEN}✅  Redis 健康${COLOR_RESET}"
else
    echo -e "${COLOR_RED}❌  Redis 健康检查失败${COLOR_RESET}"
    all_passed=false
fi
echo ""

# 4. 检查 API 服务健康状态
echo -e "${COLOR_YELLOW}[4/5] 检查 API 服务健康状态...${COLOR_RESET}"

api_healthy=false
for i in $(seq 1 $RETRY_MAX); do
    if curl -s "http://localhost:${API_PORT}/api/health" > /dev/null 2>&1; then
        api_healthy=true
        break
    fi
    echo -e "${COLOR_YELLOW}    等待 API 就绪 ($i/$RETRY_MAX)...${COLOR_RESET}"
    sleep $RETRY_INTERVAL
done

if [ "$api_healthy" = true ]; then
    health_response=$(curl -s "http://localhost:${API_PORT}/api/health")
    if echo "$health_response" | grep -q '"status":"ok"'; then
        echo -e "${COLOR_GREEN}✅  API 健康${COLOR_RESET}"
        if echo "$health_response" | grep -q '"database":"ok"'; then
            echo -e "${COLOR_GREEN}    - 数据库连接正常${COLOR_RESET}"
        fi
        if echo "$health_response" | grep -q '"redis":"ok"'; then
            echo -e "${COLOR_GREEN}    - Redis 连接正常${COLOR_RESET}"
        fi
    else
        echo -e "${COLOR_RED}❌  API 服务异常${COLOR_RESET}"
        echo -e "${COLOR_RED}    响应: $health_response${COLOR_RESET}"
        all_passed=false
    fi
else
    echo -e "${COLOR_RED}❌  API 服务不可达${COLOR_RESET}"
    all_passed=false
fi
echo ""

# 5. 检查 Nginx 代理
echo -e "${COLOR_YELLOW}[5/5] 检查 Nginx 代理...${COLOR_RESET}"

nginx_healthy=false
for i in $(seq 1 $RETRY_MAX); do
    if curl -s "http://localhost:${NGINX_PORT}/api/health" > /dev/null 2>&1; then
        nginx_healthy=true
        break
    fi
    echo -e "${COLOR_YELLOW}    等待 Nginx 就绪 ($i/$RETRY_MAX)...${COLOR_RESET}"
    sleep $RETRY_INTERVAL
done

if [ "$nginx_healthy" = true ]; then
    if curl -s "http://localhost:${NGINX_PORT}/api/health" | grep -q '"status":"ok"'; then
        echo -e "${COLOR_GREEN}✅  Nginx 代理健康${COLOR_RESET}"
    else
        echo -e "${COLOR_YELLOW}⚠️  Nginx 可用但响应异常${COLOR_RESET}"
    fi
else
    echo -e "${COLOR_RED}❌  Nginx 不可达${COLOR_RESET}"
    all_passed=false
fi
echo ""

echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
if [ "$all_passed" = true ]; then
    echo -e "${COLOR_GREEN}  冒烟测试通过!${COLOR_RESET}"
    echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_GREEN}接下来可以运行:${COLOR_RESET}"
    echo -e "  ./deploy/scripts/smoke-admin-login.sh   验证后台登录"
    echo ""
    exit 0
else
    echo -e "${COLOR_RED}  冒烟测试失败!${COLOR_RESET}"
    echo -e "${COLOR_BLUE}============================================${COLOR_RESET}"
    echo ""
    exit 1
fi
