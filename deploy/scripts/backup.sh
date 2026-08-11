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
if [ -d "$BACKUP_DIR/.restore.lock" ]; then
  echo "备份失败：恢复任务正在运行" >&2
  exit 1
fi
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "备份失败：已有备份任务正在运行" >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
UPLOAD_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
CHECKSUM_FILE="$BACKUP_DIR/checksums_${TIMESTAMP}.sha256"
DB_TMP="${DB_FILE}.tmp"
UPLOAD_TMP="${UPLOAD_FILE}.tmp"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")
API_WAS_RUNNING=false
NGINX_WAS_RUNNING=false
QUIESCED=false
RESTORE_RUNTIME_FAILED=false

container_running() {
  local name="$1"
  [ "$(docker inspect --format '{{.State.Running}}' "$name" 2>/dev/null || true)" = "true" ]
}

wait_api_healthy() {
  for _ in $(seq 1 60); do
    local health
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' baby-mall-api 2>/dev/null || true)"
    [ "$health" = "healthy" ] && return 0
    [ "$health" = "unhealthy" ] || [ "$health" = "exited" ] && return 1
    sleep 2
  done
  return 1
}

restore_runtime() {
  [ "$QUIESCED" = true ] || return 0

  if [ "$API_WAS_RUNNING" = true ]; then
    "${COMPOSE[@]}" start api >/dev/null || return 1
    wait_api_healthy || return 1
  fi
  if [ "$NGINX_WAS_RUNNING" = true ]; then
    "${COMPOSE[@]}" start nginx >/dev/null || return 1
    docker exec baby-mall-nginx nginx -t >/dev/null || return 1
  fi
  QUIESCED=false
}

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  rm -f "$DB_TMP" "$UPLOAD_TMP"
  if [ "$QUIESCED" = true ]; then
    restore_runtime || RESTORE_RUNTIME_FAILED=true
  fi
  rmdir "$LOCK_DIR" 2>/dev/null || true
  if [ "$RESTORE_RUNTIME_FAILED" = true ]; then
    echo "备份后恢复原运行状态失败；请保持公网关闭并人工检查 API/Nginx" >&2
    exit 1
  fi
  exit "$status"
}
trap cleanup EXIT

"${COMPOSE[@]}" config >/dev/null

if ! "${COMPOSE[@]}" ps --status running --services | grep -qx mysql; then
  echo "备份失败：MySQL 容器未运行" >&2
  exit 1
fi

container_running baby-mall-api && API_WAS_RUNNING=true
container_running baby-mall-nginx && NGINX_WAS_RUNNING=true

printf '%s\n' "========================================="
printf '%s\n' "  禧孕优选生产一致性备份"
printf '%s\n' "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
printf '%s\n' "  目录: $BACKUP_DIR"
printf '%s\n' "========================================="

echo "[1/5] 暂停公网和 API/background writers..."
if [ "$NGINX_WAS_RUNNING" = true ]; then
  "${COMPOSE[@]}" stop -t 10 nginx >/dev/null
fi
if [ "$API_WAS_RUNNING" = true ]; then
  "${COMPOSE[@]}" stop -t 30 api >/dev/null
fi
container_running baby-mall-nginx && { echo "备份失败：Nginx 未停止" >&2; exit 1; }
container_running baby-mall-api && { echo "备份失败：API 未停止" >&2; exit 1; }
QUIESCED=true

echo "[2/5] 备份 MySQL 数据库..."
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
echo "数据库备份成功: $(basename "$DB_FILE")"

echo "[3/5] 备份同一维护窗口的上传文件..."
"${COMPOSE[@]}" run --rm --no-deps --entrypoint sh api -lc '
  cd /app/apps/api/uploads
  exec tar -czf - .
' > "$UPLOAD_TMP"
tar -tzf "$UPLOAD_TMP" >/dev/null
test -s "$UPLOAD_TMP"
mv "$UPLOAD_TMP" "$UPLOAD_FILE"
chmod 600 "$UPLOAD_FILE"
echo "上传文件备份成功: $(basename "$UPLOAD_FILE")"

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$DB_FILE")" "$(basename "$UPLOAD_FILE")" > "$(basename "$CHECKSUM_FILE")"
)
chmod 600 "$CHECKSUM_FILE"

echo "[4/5] 恢复备份前运行状态..."
restore_runtime

echo "[5/5] 清理 ${RETENTION_DAYS} 天前的完整备份..."
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db_*.sql.gz' -o -name 'uploads_*.tar.gz' -o -name 'checksums_*.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "备份完成："
ls -lh "$DB_FILE" "$UPLOAD_FILE" "$CHECKSUM_FILE"
