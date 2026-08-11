#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if [ ! -f "$ENV_FILE" ]; then
  echo "备份失败：环境文件不存在：$ENV_FILE" >&2
  exit 1
fi
if ! [[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "备份失败：BACKUP_RETENTION_DAYS 必须为正整数" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

LOCK_DIR="$BACKUP_DIR/.backup.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "备份失败：已有备份任务正在运行" >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_BASENAME="db_${TIMESTAMP}.sql.gz"
UPLOAD_BASENAME="uploads_${TIMESTAMP}.tar.gz"
CHECKSUM_BASENAME="checksums_${TIMESTAMP}.sha256"
DB_FILE="$BACKUP_DIR/$DB_BASENAME"
UPLOAD_FILE="$BACKUP_DIR/$UPLOAD_BASENAME"
CHECKSUM_FILE="$BACKUP_DIR/$CHECKSUM_BASENAME"
DB_TMP="${DB_FILE}.tmp"
UPLOAD_TMP="${UPLOAD_FILE}.tmp"

cleanup() {
  rm -f "$DB_TMP" "$UPLOAD_TMP"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")
"${COMPOSE[@]}" config >/dev/null

if ! "${COMPOSE[@]}" ps --status running --services | grep -qx mysql; then
  echo "备份失败：MySQL 容器未运行" >&2
  exit 1
fi

printf '%s\n' "========================================="
printf '%s\n' "  禧孕优选生产备份"
printf '%s\n' "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
printf '%s\n' "  目录: $BACKUP_DIR"
printf '%s\n' "========================================="

echo "[1/3] 备份 MySQL 数据库..."
"${COMPOSE[@]}" exec -T mysql sh -lc '
  exec mysqldump \
    -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    "$MYSQL_DATABASE"
' | gzip -c > "$DB_TMP"

gzip -t "$DB_TMP"
test -s "$DB_TMP"
mv "$DB_TMP" "$DB_FILE"
chmod 600 "$DB_FILE"
echo "数据库备份成功: $DB_BASENAME"

echo "[2/3] 备份上传文件..."
"${COMPOSE[@]}" run --rm --no-deps --entrypoint sh api -lc '
  cd /app/apps/api/uploads
  exec tar -czf - .
' > "$UPLOAD_TMP"

tar -tzf "$UPLOAD_TMP" >/dev/null
test -s "$UPLOAD_TMP"
mv "$UPLOAD_TMP" "$UPLOAD_FILE"
chmod 600 "$UPLOAD_FILE"
echo "上传文件备份成功: $UPLOAD_BASENAME"

# Store relative names so a complete backup set can be copied to a different server/path and
# still be verified there during disaster recovery.
(
  cd "$BACKUP_DIR"
  sha256sum "$DB_BASENAME" "$UPLOAD_BASENAME" > "$CHECKSUM_BASENAME"
)
chmod 600 "$CHECKSUM_FILE"

echo "[3/3] 清理 ${RETENTION_DAYS} 天前的备份..."
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db_*.sql.gz' -o -name 'uploads_*.tar.gz' -o -name 'checksums_*.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "备份完成："
ls -lh "$DB_FILE" "$UPLOAD_FILE" "$CHECKSUM_FILE"
