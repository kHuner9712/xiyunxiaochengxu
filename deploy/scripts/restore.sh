#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$DEPLOY_DIR/backups"

DB_NAME="${DB_NAME:-baby_mall}"
DB_PASSWORD="${DB_PASSWORD:-baby_mall_2024}"

echo "========================================="
echo "  Baby Mall 数据恢复脚本"
echo "========================================="

if [ -z "$1" ]; then
    echo "可用的数据库备份:"
    echo ""
    ls -lht "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null || echo "未找到备份文件"
    echo ""
    echo "用法: $0 <备份文件名>"
    echo "示例: $0 db_baby_mall_20240101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "即将恢复数据库: $DB_NAME"
echo "备份文件: $BACKUP_FILE"
echo ""
read -p "确认恢复？此操作将覆盖当前数据！(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "已取消恢复"
    exit 0
fi

echo "[1/2] 解压并恢复数据库..."
gunzip -c "$BACKUP_FILE" | docker-compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T mysql mysql \
    -uroot -p"$DB_PASSWORD" "$DB_NAME"

if [ $? -eq 0 ]; then
    echo "数据库恢复成功！"
else
    echo "数据库恢复失败！"
    exit 1
fi

echo "[2/2] 重启 API 服务..."
docker-compose -f "$DEPLOY_DIR/docker-compose.yml" restart api

echo ""
echo "========================================="
echo "  恢复完成！"
echo "========================================="
