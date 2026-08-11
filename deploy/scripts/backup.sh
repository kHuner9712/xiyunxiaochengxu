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

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")
"${COMPOSE[@]}" config >/dev/null

service_running() {
  local service="$1"
  "${COMPOSE[@]}" ps --status running --services | grep -qx "$service"
}

wait_api_health() {
  for attempt in $(seq 1 90); do
    if "${COMPOSE[@]}" exec -T api node -e '
      fetch("http://127.0.0.1:3000/api/health")
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok || body?.status !== "ok" || body?.services?.database !== "ok" || body?.services?.redis !== "ok") process.exit(1);
        })
        .catch(() => process.exit(1));
    ' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

API_WAS_RUNNING=false
NGINX_WAS_RUNNING=false
service_running api && API_WAS_RUNNING=true
service_running nginx && NGINX_WAS_RUNNING=true

if [ "$NGINX_WAS_RUNNING" = true ] && [ "$API_WAS_RUNNING" != true ]; then
  echo "备份失败：Nginx 正在运行但 API 未运行；拒绝在异常生产状态下创建可宣称一致的在线备份" >&2
  rmdir "$LOCK_DIR" 2>/dev/null || true
  exit 1
fi
if ! service_running mysql; then
  echo "备份失败：MySQL 容器未运行" >&2
  rmdir "$LOCK_DIR" 2>/dev/null || true
  exit 1
fi

WRITERS_QUIESCED=false
RUNTIME_RESTORED=false

restore_previous_runtime() {
  local ok=true
  if [ "$API_WAS_RUNNING" = true ]; then
    echo "恢复备份前 API 运行状态..." >&2
    if ! SKIP_MIGRATE=true "${COMPOSE[@]}" up -d api >/dev/null; then
      ok=false
    elif ! wait_api_health; then
      echo "备份后 API 未通过健康检查；不会重新开放 Nginx" >&2
      ok=false
    fi
  fi

  if [ "$NGINX_WAS_RUNNING" = true ]; then
    if [ "$ok" = true ]; then
      if ! "${COMPOSE[@]}" up -d nginx >/dev/null; then
        ok=false
      fi
    else
      "${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
    fi
  fi

  [ "$ok" = true ]
}

cleanup() {
  status=$?
  rm -f "$DB_TMP" "$UPLOAD_TMP"

  if [ "$WRITERS_QUIESCED" = true ] && [ "$RUNTIME_RESTORED" != true ]; then
    if restore_previous_runtime; then
      RUNTIME_RESTORED=true
    else
      echo "备份流程结束但原生产运行状态恢复失败；Nginx 保持关闭，请立即人工处理" >&2
      status=1
    fi
  fi

  rmdir "$LOCK_DIR" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT

printf '%s\n' "========================================="
printf '%s\n' "  禧孕优选一致性生产备份"
printf '%s\n' "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
printf '%s\n' "  目录: $BACKUP_DIR"
printf '%s\n' "========================================="

# Database rows and local uploads are one restore unit but cannot share a storage transaction.
# Mark the quiesce phase before the first stop command so the EXIT trap restores prior runtime even
# if one of the stop operations itself fails after an earlier service has already been stopped.
WRITERS_QUIESCED=true
if [ "$NGINX_WAS_RUNNING" = true ]; then
  echo "[1/5] 关闭 Nginx 公网入口..."
  "${COMPOSE[@]}" stop nginx >/dev/null
fi
if [ "$API_WAS_RUNNING" = true ]; then
  echo "[1/5] 优雅停止 API writers / scheduler..."
  "${COMPOSE[@]}" stop api >/dev/null
fi

if service_running api || service_running nginx; then
  echo "备份失败：无法确认 API/Nginx writers 已停止" >&2
  exit 1
fi

echo "[2/5] 在无应用写入窗口备份 MySQL..."
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

echo "[3/5] 在同一无写入窗口备份 uploads..."
"${COMPOSE[@]}" run --rm --no-deps --entrypoint sh api -lc '
  cd /app/apps/api/uploads
  exec tar -czf - .
' > "$UPLOAD_TMP"

tar -tzf "$UPLOAD_TMP" >/dev/null
test -s "$UPLOAD_TMP"
mv "$UPLOAD_TMP" "$UPLOAD_FILE"
chmod 600 "$UPLOAD_FILE"
echo "上传文件备份成功: $UPLOAD_BASENAME"

(
  cd "$BACKUP_DIR"
  sha256sum "$DB_BASENAME" "$UPLOAD_BASENAME" > "$CHECKSUM_BASENAME"
)
chmod 600 "$CHECKSUM_FILE"

echo "[4/5] 恢复备份前生产运行状态..."
if ! restore_previous_runtime; then
  echo "备份文件已生成，但 API/Nginx 原运行状态恢复失败；拒绝报告备份成功" >&2
  exit 1
fi
RUNTIME_RESTORED=true

echo "[5/5] 清理 ${RETENTION_DAYS} 天前的完整备份文件..."
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db_*.sql.gz' -o -name 'uploads_*.tar.gz' -o -name 'checksums_*.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "一致性备份完成："
ls -lh "$DB_FILE" "$UPLOAD_FILE" "$CHECKSUM_FILE"
