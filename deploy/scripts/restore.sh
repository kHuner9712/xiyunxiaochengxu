#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"

fail() {
  echo "恢复失败：$1" >&2
  exit 1
}

[ -f "$ENV_FILE" ] || fail "环境文件不存在：$ENV_FILE"
command -v docker >/dev/null 2>&1 || fail "缺少 docker"
command -v sha256sum >/dev/null 2>&1 || fail "缺少 sha256sum"
command -v gzip >/dev/null 2>&1 || fail "缺少 gzip"
docker compose version >/dev/null 2>&1 || fail "docker compose 不可用"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")
"${COMPOSE[@]}" config >/dev/null

list_complete_backups() {
  local checksum timestamp
  echo "可用的完整备份集："
  for checksum in "$BACKUP_DIR"/checksums_*.sha256; do
    [ -f "$checksum" ] || continue
    timestamp="$(basename "$checksum")"
    timestamp="${timestamp#checksums_}"
    timestamp="${timestamp%.sha256}"
    if [ -f "$BACKUP_DIR/db_${timestamp}.sql.gz" ] && [ -f "$BACKUP_DIR/uploads_${timestamp}.tar.gz" ]; then
      echo "  $timestamp"
    fi
  done
}

if [ $# -lt 1 ]; then
  list_complete_backups
  echo ""
  echo "用法: $0 <YYYYMMDD_HHMMSS | db_YYYYMMDD_HHMMSS.sql.gz>"
  exit 1
fi

ARG="$(basename "$1")"
case "$ARG" in
  db_*.sql.gz)
    TIMESTAMP="${ARG#db_}"
    TIMESTAMP="${TIMESTAMP%.sql.gz}"
    ;;
  *)
    TIMESTAMP="$ARG"
    ;;
esac
[[ "$TIMESTAMP" =~ ^[0-9]{8}_[0-9]{6}$ ]] || fail "备份标识格式无效：$TIMESTAMP"

DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
UPLOAD_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
CHECKSUM_FILE="$BACKUP_DIR/checksums_${TIMESTAMP}.sha256"
for file in "$DB_FILE" "$UPLOAD_FILE" "$CHECKSUM_FILE"; do
  [ -f "$file" ] || fail "完整备份集缺少文件：$file"
done

gzip -t "$DB_FILE" || fail "数据库备份 gzip 校验失败"
tar -tzf "$UPLOAD_FILE" >/dev/null || fail "上传文件备份 tar 校验失败"

verify_manifest_file() {
  local target="$1"
  local target_name expected actual
  target_name="$(basename "$target")"
  expected="$(awk -v target="$target_name" '
    {
      path=$2
      sub(/^\*/, "", path)
      name=path
      sub(/^.*\//, "", name)
      if (name == target) { print $1; exit }
    }
  ' "$CHECKSUM_FILE")"
  [ -n "$expected" ] || fail "checksum manifest 未包含 $target_name"
  actual="$(sha256sum "$target" | awk '{print $1}')"
  [ "$actual" = "$expected" ] || fail "$target_name 的 SHA256 不匹配"
}
verify_manifest_file "$DB_FILE"
verify_manifest_file "$UPLOAD_FILE"

echo "========================================="
echo "  禧孕优选完整灾难恢复"
echo "  环境文件: $ENV_FILE"
echo "  目标备份: $TIMESTAMP"
echo "========================================="
read -r -p "此操作将覆盖当前数据库和全部 uploads。输入 yes 继续: " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "已取消恢复"; exit 0; }

LOCK_DIR="$BACKUP_DIR/.restore.lock"
[ ! -d "$BACKUP_DIR/.backup.lock" ] || fail "备份任务正在运行"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  fail "已有恢复任务正在运行"
fi

API_WAS_RUNNING=false
NGINX_WAS_RUNNING=false
QUIESCED=false
DESTRUCTIVE_STARTED=false
RESTORE_SUCCEEDED=false
RESCUE_DB_FILE=""
RESCUE_UPLOAD_FILE=""
RESCUE_CHECKSUM_FILE=""

container_running() {
  local name="$1"
  [ "$(docker inspect --format '{{.State.Running}}' "$name" 2>/dev/null || true)" = "true" ]
}

wait_api_healthy() {
  for _ in $(seq 1 60); do
    local health
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' baby-mall-api 2>/dev/null || true)"
    [ "$health" = "healthy" ] && return 0
    if [ "$health" = "unhealthy" ] || [ "$health" = "exited" ]; then return 1; fi
    sleep 2
  done
  return 1
}

restore_original_runtime_if_safe() {
  [ "$QUIESCED" = true ] || return 0
  [ "$DESTRUCTIVE_STARTED" = false ] || return 0
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

on_exit() {
  local status=$?
  trap - EXIT
  set +e
  rmdir "$LOCK_DIR" 2>/dev/null || true

  if [ "$status" -ne 0 ] && [ "$QUIESCED" = true ]; then
    if [ "$DESTRUCTIVE_STARTED" = true ]; then
      "${COMPOSE[@]}" stop nginx api >/dev/null 2>&1 || true
      echo "恢复未完成：已保持 API/Nginx 停止，禁止公网继续写入。" >&2
      if [ -n "$RESCUE_DB_FILE" ]; then
        echo "破坏性恢复前救援快照：" >&2
        echo "  $RESCUE_DB_FILE" >&2
        echo "  $RESCUE_UPLOAD_FILE" >&2
        echo "  $RESCUE_CHECKSUM_FILE" >&2
      fi
    else
      restore_original_runtime_if_safe || echo "原运行状态恢复失败，请人工检查 API/Nginx。" >&2
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

"${COMPOSE[@]}" up -d mysql redis >/dev/null
container_running baby-mall-mysql || fail "MySQL 容器未运行"

container_running baby-mall-api && API_WAS_RUNNING=true
container_running baby-mall-nginx && NGINX_WAS_RUNNING=true

echo "[1/7] 停止公网和 API/background writers..."
if [ "$NGINX_WAS_RUNNING" = true ]; then "${COMPOSE[@]}" stop -t 10 nginx >/dev/null; fi
if [ "$API_WAS_RUNNING" = true ]; then "${COMPOSE[@]}" stop -t 30 api >/dev/null; fi
container_running baby-mall-nginx && fail "Nginx 未停止"
container_running baby-mall-api && fail "API 未停止"
QUIESCED=true

echo "[2/7] 创建破坏性恢复前救援快照..."
RESCUE_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RESCUE_DB_FILE="$BACKUP_DIR/pre_restore_db_${RESCUE_TIMESTAMP}.sql.gz"
RESCUE_UPLOAD_FILE="$BACKUP_DIR/pre_restore_uploads_${RESCUE_TIMESTAMP}.tar.gz"
RESCUE_CHECKSUM_FILE="$BACKUP_DIR/pre_restore_checksums_${RESCUE_TIMESTAMP}.sha256"
if "${COMPOSE[@]}" exec -T mysql sh -lc '
  exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF "$MYSQL_DATABASE"
' | gzip -c > "$RESCUE_DB_FILE" \
  && gzip -t "$RESCUE_DB_FILE" \
  && test -s "$RESCUE_DB_FILE" \
  && "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh api -lc 'cd /app/apps/api/uploads && exec tar -czf - .' > "$RESCUE_UPLOAD_FILE" \
  && tar -tzf "$RESCUE_UPLOAD_FILE" >/dev/null \
  && test -s "$RESCUE_UPLOAD_FILE"; then
  (
    cd "$BACKUP_DIR"
    sha256sum "$(basename "$RESCUE_DB_FILE")" "$(basename "$RESCUE_UPLOAD_FILE")" > "$(basename "$RESCUE_CHECKSUM_FILE")"
  )
  chmod 600 "$RESCUE_DB_FILE" "$RESCUE_UPLOAD_FILE" "$RESCUE_CHECKSUM_FILE"
else
  rm -f "$RESCUE_DB_FILE" "$RESCUE_UPLOAD_FILE" "$RESCUE_CHECKSUM_FILE"
  RESCUE_DB_FILE=""
  RESCUE_UPLOAD_FILE=""
  RESCUE_CHECKSUM_FILE=""
  [ "${ALLOW_RESTORE_WITHOUT_RESCUE_BACKUP:-false}" = "true" ] || fail "无法创建当前状态救援快照；如数据库已损坏且确认必须继续，请显式设置 ALLOW_RESTORE_WITHOUT_RESCUE_BACKUP=true 后重试"
  echo "警告：已显式允许无救援快照恢复。"
fi

DESTRUCTIVE_STARTED=true

echo "[3/7] 重建并恢复数据库..."
"${COMPOSE[@]}" exec -T mysql sh -lc '
  db="$MYSQL_DATABASE"
  case "$db" in ""|*[!A-Za-z0-9_]*) echo "unsafe MYSQL_DATABASE" >&2; exit 2;; esac
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$db\`; CREATE DATABASE \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
'
gzip -dc "$DB_FILE" | "${COMPOSE[@]}" exec -T mysql sh -lc 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

echo "[4/7] 清空并恢复同批次 uploads..."
cat "$UPLOAD_FILE" | "${COMPOSE[@]}" run -T --rm --no-deps --entrypoint sh api -lc '
  set -e
  mkdir -p /app/apps/api/uploads
  find /app/apps/api/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  tar -xzf - -C /app/apps/api/uploads
'

echo "[5/7] 将恢复库迁移到当前代码 schema..."
"${COMPOSE[@]}" run --rm --no-deps api npx prisma migrate deploy

echo "[6/7] 启动 API，健康后再开放 Nginx..."
SKIP_MIGRATE=true "${COMPOSE[@]}" up -d --no-deps --force-recreate api >/dev/null
wait_api_healthy || fail "恢复后的 API 未通过健康检查"
"${COMPOSE[@]}" up -d --no-deps --force-recreate nginx >/dev/null
docker exec baby-mall-nginx nginx -t >/dev/null

echo "[7/7] 执行完整 runtime smoke..."
if ! ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/smoke-runtime.sh"; then
  "${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
  fail "runtime smoke 未通过；Nginx 已重新关闭"
fi

RESTORE_SUCCEEDED=true
QUIESCED=false
trap - EXIT
rmdir "$LOCK_DIR" 2>/dev/null || true

echo "========================================="
echo "  完整恢复成功"
echo "  目标备份: $TIMESTAMP"
if [ -n "$RESCUE_DB_FILE" ]; then
  echo "  恢复前救援快照: $(basename "$RESCUE_DB_FILE")"
fi
echo "========================================="
