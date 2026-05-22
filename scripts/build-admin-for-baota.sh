#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ADMIN_DIST="$PROJECT_ROOT/apps/admin-web/dist"
BAOTA_DIR="${1:-/www/wwwroot/baby-mall-admin}"

echo "=== 宝塔后台静态文件构建脚本 ==="
echo "项目根目录: $PROJECT_ROOT"
echo "构建产物目录: $ADMIN_DIST"
echo "宝塔站点目录: $BAOTA_DIR"
echo ""

cd "$PROJECT_ROOT"

echo "[1/3] 安装依赖..."
pnpm install --no-frozen-lockfile

echo "[2/3] 构建 @baby-mall/shared..."
pnpm --filter @baby-mall/shared build

echo "[3/3] 构建 @baby-mall/admin-web..."
pnpm --filter @baby-mall/admin-web build

echo ""
if [ -d "$ADMIN_DIST" ]; then
  echo "构建成功！产物位于: $ADMIN_DIST"
  echo ""
  echo "部署到宝塔站点目录，请执行："
  echo ""
  echo "  rm -rf $BAOTA_DIR/*"
  echo "  cp -r $ADMIN_DIST/* $BAOTA_DIR/"
  echo ""
  echo "或者直接执行："
  echo "  $0 deploy"
  echo ""
  if [ "$1" = "deploy" ]; then
    echo "正在部署到 $BAOTA_DIR ..."
    mkdir -p "$BAOTA_DIR"
    rm -rf "$BAOTA_DIR/*"
    cp -r "$ADMIN_DIST"/* "$BAOTA_DIR/"
    echo "部署完成！"
  fi
else
  echo "错误：构建产物目录不存在: $ADMIN_DIST"
  exit 1
fi
