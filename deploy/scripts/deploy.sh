#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================="
echo "  Baby Mall 部署脚本"
echo "========================================="

echo "[1/6] 拉取最新代码..."
cd "$PROJECT_DIR"
git pull origin main

echo "[2/6] 安装前端依赖并构建管理后台..."
cd "$PROJECT_DIR"
npm install -g pnpm
pnpm install --frozen-lockfile
cd "$PROJECT_DIR/apps/admin-web" && pnpm build

echo "[3/6] 检查 .env 文件..."
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo "警告: .env 文件不存在，使用默认配置"
    echo "建议复制 .env.example 并修改配置: cp .env.example .env"
fi

echo "[4/6] 停止旧容器..."
cd "$DEPLOY_DIR"
docker-compose down

echo "[5/6] 构建并启动容器..."
docker-compose build --no-cache api
docker-compose up -d

echo "[6/6] 等待服务启动..."
echo "等待 MySQL 启动..."
sleep 15

echo "运行数据库迁移..."
docker-compose exec -T api npx prisma migrate deploy 2>/dev/null || echo "迁移跳过或失败，请手动检查"

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo "  API:     http://localhost/api"
echo "  管理后台: http://localhost"
echo "  MySQL:   localhost:3306"
echo "  Redis:   localhost:6379"
echo "========================================="
echo ""
echo "查看日志: docker-compose logs -f"
echo "查看状态: docker-compose ps"
