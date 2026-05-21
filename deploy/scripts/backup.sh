#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$DEPLOY_DIR/backups"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-baby_mall}"
DB_PASSWORD="${DB_PASSWORD:-baby_mall_2024}"

echo "========================================="
echo "  Baby Mall 备份脚本"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

echo "[1/3] 备份 MySQL 数据库..."
docker-compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T mysql mysqldump \
    -uroot -p"$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    "$DB_NAME" | gzip > "$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"

if [ $? -eq 0 ]; then
    echo "数据库备份成功: db_${DB_NAME}_${TIMESTAMP}.sql.gz"
else
    echo "数据库备份失败！"
    exit 1
fi

echo "[2/3] 备份上传文件..."
tar -czf "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" -C /var/lib/docker/volumes/deploy_upload_data/_data . 2>/dev/null || \
    docker run --rm -v deploy_upload_data:/data -v "$BACKUP_DIR":/backup alpine tar -czf /backup/uploads_${TIMESTAMP}.tar.gz -C /data .

echo "文件备份成功: uploads_${TIMESTAMP}.tar.gz"

echo "[3/3] 清理 ${RETENTION_DAYS} 天前的备份..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
echo "清理完成"

echo ""
echo "========================================="
echo "  备份完成！"
echo "  备份目录: $BACKUP_DIR"
echo "========================================="
ls -lh "$BACKUP_DIR" | tail -5
