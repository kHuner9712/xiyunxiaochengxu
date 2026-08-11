#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"

usage() {
  cat >&2 <<'EOF'
用法: bash deploy/scripts/restore.sh db_YYYYMMDD_HHMMSS.sql.gz

恢复要求同一批次的三个文件同时存在：
  db_YYYYMMDD_HHMMSS.sql.gz
  uploads_YYYYMMDD_HHMMSS.tar.gz
  checksums_YYYYMMDD_HHMMSS.sha256

为防止误操作，交互模式需要输入备份时间戳确认；非交互模式请设置：
  RESTORE_CONFIRM=YYYYMMDD_HHMMSS
EOF
}

if [ ! -f "$ENV_FILE" ]; then
  echo "恢复失败：环境文件不存在：$ENV_FILE" >&2
  exit 1
fi
if [ ! -d "$BACKUP_DIR" ]; then
  echo "恢复失败：备份目录不存在：$BACKUP_DIR" >&2
  exit 1
fi
if [ "$#" -ne 1 ]; then
  usage
  echo >&2
  echo "可用数据库备份：" >&2
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db_*.sql.gz' -printf '%f\n' 2>/dev/null | sort -r >&2 || true
  exit 1
fi

DB_BASENAME="$1"
if [[ ! "$DB_BASENAME" =~ ^db_([0-9]{8}_[0-9]{6})\.sql\.gz$ ]]; then
  echo "恢复失败：备份文件名必须是 db_YYYYMMDD_HHMMSS.sql.gz，且不能包含路径" >&2
  exit 1
fi
TIMESTAMP="${BASH_REMATCH[1]}"
UPLOAD_BASENAME="uploads_${TIMESTAMP}.tar.gz"
CHECKSUM_BASENAME="checksums_${TIMESTAMP}.sha256"
DB_FILE="$BACKUP_DIR/$DB_BASENAME"
UPLOAD_FILE="$BACKUP_DIR/$UPLOAD_BASENAME"
CHECKSUM_FILE="$BACKUP_DIR/$CHECKSUM_BASENAME"

for required in "$DB_FILE" "$UPLOAD_FILE" "$CHECKSUM_FILE"; do
  if [ ! -f "$required" ]; then
    echo "恢复失败：同批次备份不完整，缺少 $(basename "$required")" >&2
    exit 1
  fi
  if [ ! -s "$required" ]; then
    echo "恢复失败：备份文件为空：$(basename "$required")" >&2
    exit 1
  fi
done

# Validate both archives before stopping any production writer.
gzip -t "$DB_FILE"
tar -tzf "$UPLOAD_FILE" >/dev/null

# Verify hashes ourselves instead of `sha256sum -c`: new manifests contain portable relative
# names, while backups produced by older releases may contain absolute paths. In both cases only
# the basename is trusted and mapped back into BACKUP_DIR.
seen_db=0
seen_upload=0
while read -r expected source_path extra; do
  if [ -z "${expected:-}" ] || [ -z "${source_path:-}" ] || [ -n "${extra:-}" ]; then
    echo "恢复失败：checksum manifest 格式无效" >&2
    exit 1
  fi
  if [[ ! "$expected" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "恢复失败：checksum manifest 包含非法 SHA-256" >&2
    exit 1
  fi
  source_name="$(basename -- "$source_path")"
  case "$source_name" in
    "$DB_BASENAME") actual_file="$DB_FILE"; seen_db=$((seen_db + 1)) ;;
    "$UPLOAD_BASENAME") actual_file="$UPLOAD_FILE"; seen_upload=$((seen_upload + 1)) ;;
    *)
      echo "恢复失败：checksum manifest 包含非本批次文件：$source_name" >&2
      exit 1
      ;;
  esac
  actual="$(sha256sum "$actual_file" | awk '{print $1}')"
  if [ "${actual,,}" != "${expected,,}" ]; then
    echo "恢复失败：SHA-256 校验失败：$source_name" >&2
    exit 1
  fi
done < "$CHECKSUM_FILE"

if [ "$seen_db" -ne 1 ] || [ "$seen_upload" -ne 1 ]; then
  echo "恢复失败：checksum manifest 必须且只能各包含一份数据库和 uploads 备份" >&2
  exit 1
fi

if [ -n "${RESTORE_CONFIRM:-}" ]; then
  confirm="$RESTORE_CONFIRM"
elif [ -t 0 ]; then
  echo "警告：将把生产数据库和上传文件一起恢复到批次 $TIMESTAMP。" >&2
  read -r -p "请输入备份时间戳 $TIMESTAMP 以确认恢复: " confirm
else
  echo "恢复失败：非交互模式必须设置 RESTORE_CONFIRM=$TIMESTAMP" >&2
  exit 1
fi
if [ "$confirm" != "$TIMESTAMP" ]; then
  echo "恢复已取消：确认值不匹配" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")
"${COMPOSE[@]}" config >/dev/null

# MySQL and Redis are infrastructure dependencies for the restored API. Start them first and keep
# them private; public traffic remains closed until the restored API passes health checks.
"${COMPOSE[@]}" up -d mysql redis
for attempt in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T mysql sh -lc 'mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "恢复失败：MySQL 未在预期时间内就绪" >&2
    exit 1
  fi
  sleep 2
done

runtime_closed=0
on_exit() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$runtime_closed" -eq 1 ]; then
    # This also covers a failure in the final public smoke after Nginx has briefly started.
    # Never leave public traffic open when the restored stack has not passed the full contract.
    "${COMPOSE[@]}" stop nginx >/dev/null 2>&1 || true
    echo >&2
    echo "恢复失败且公网保持关闭：Nginx 已停止，不会自动重新开放。" >&2
    echo "请先确认数据库与 uploads 状态，再人工处理或使用另一份完整备份重试。" >&2
  fi
  exit "$status"
}
trap on_exit EXIT

echo "[1/6] 关闭公网入口和 API writers..."
"${COMPOSE[@]}" stop nginx api >/dev/null 2>&1 || true
runtime_closed=1

echo "[2/6] 重建并恢复数据库..."
"${COMPOSE[@]}" exec -T mysql sh -lc '
  set -eu
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
'
gzip -dc "$DB_FILE" | "${COMPOSE[@]}" exec -T mysql sh -lc '
  exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"
'

echo "[3/6] 恢复同批次 uploads 卷..."
# Override the normal API entrypoint so this helper only manipulates the already-mounted uploads
# volume. The runtime image currently runs as root, so restored ownership matches normal writes.
gzip -dc "$UPLOAD_FILE" | "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh api -lc '
  set -eu
  cd /app/apps/api/uploads
  find . -mindepth 1 -maxdepth 1 -exec rm -rf -- {} \;
  tar -xf -
'

echo "[4/6] 启动恢复后的 API 并等待健康检查..."
"${COMPOSE[@]}" up -d api
for attempt in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T api node -e '
    fetch("http://127.0.0.1:3000/health")
      .then(async (r) => { const body = await r.json(); if (!r.ok || body?.status !== "ok") process.exit(1); })
      .catch(() => process.exit(1));
  ' >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 90 ]; then
    echo "恢复失败：恢复后的 API 未通过 /health；Nginx 保持关闭" >&2
    exit 1
  fi
  sleep 2
done

echo "[5/6] API 健康，临时启动 Nginx 进行完整 runtime smoke..."
"${COMPOSE[@]}" up -d nginx

echo "[6/6] 验证 HTTPS/Nginx/API/MySQL/Redis/上传/回调运行时合同..."
ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/smoke-runtime.sh"

runtime_closed=0
trap - EXIT
printf '%s\n' "========================================="
printf '%s\n' "生产恢复完成：$TIMESTAMP"
printf '%s\n' "数据库与 uploads 来自同一校验批次。"
printf '%s\n' "完整 runtime smoke 已通过，公网入口保持开放。"
printf '%s\n' "========================================="
