#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
PULL_CODE="${PULL_CODE:-true}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

if [ ! -f "$ENV_FILE" ]; then
  echo "部署失败：环境文件不存在：$ENV_FILE" >&2
  exit 1
fi

for command in git docker curl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "部署失败：缺少命令 $command" >&2
    exit 1
  fi
done

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")

print_diagnostics() {
  local status=$?
  echo "部署失败，当前容器状态：" >&2
  "${COMPOSE[@]}" ps >&2 || true
  echo "API/Nginx 最近日志：" >&2
  "${COMPOSE[@]}" logs --tail=120 api nginx >&2 || true
  exit "$status"
}
trap print_diagnostics ERR

echo "========================================="
echo "  禧孕优选生产部署"
echo "  环境文件: $ENV_FILE"
echo "========================================="

if [ "$PULL_CODE" = "true" ]; then
  echo "[1/7] 更新 main 分支..."
  cd "$PROJECT_DIR"
  current_branch="$(git branch --show-current)"
  if [ "$current_branch" != "main" ]; then
    echo "部署失败：当前分支为 $current_branch，生产部署必须在 main 分支执行" >&2
    exit 1
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "部署失败：服务器工作区存在未提交修改，请先处理后再部署" >&2
    git status --short >&2 || true
    exit 1
  fi
  git fetch origin main
  git merge --ff-only origin/main
else
  echo "[1/7] 跳过代码拉取（PULL_CODE=$PULL_CODE）"
fi

cd "$DEPLOY_DIR"
echo "[2/7] 校验 Docker Compose 配置..."
"${COMPOSE[@]}" config >/dev/null

if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
  echo "[3/7] 部署前备份数据库与上传文件..."
  ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup.sh"
else
  echo "[3/7] 跳过部署前备份（BACKUP_BEFORE_DEPLOY=$BACKUP_BEFORE_DEPLOY）"
fi

echo "[4/7] 构建 API 与管理后台镜像..."
"${COMPOSE[@]}" build api

echo "[5/7] 启动数据库与缓存，并执行数据库迁移..."
"${COMPOSE[@]}" up -d mysql redis
"${COMPOSE[@]}" run --rm --no-deps --entrypoint sh api -lc \
  'cd /app/apps/api && npx prisma migrate deploy'

echo "[6/7] 更新 API 与 Nginx（不执行 docker compose down）..."
SKIP_MIGRATE=true "${COMPOSE[@]}" up -d --remove-orphans api nginx

echo "等待 API 健康检查..."
api_ready=false
for _ in $(seq 1 40); do
  if curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    api_ready=true
    break
  fi
  sleep 3
done
if [ "$api_ready" != "true" ]; then
  echo "部署失败：API 在等待窗口内未恢复健康" >&2
  exit 1
fi

"${COMPOSE[@]}" exec -T nginx nginx -t

echo "[7/7] 验证公网 API、管理后台与 TLS 证书..."
bash "$SCRIPT_DIR/production-smoke.sh"

trap - ERR

echo ""
echo "========================================="
echo "  部署成功"
echo "========================================="
"${COMPOSE[@]}" ps
echo "API: https://api.yunxixiaochengxu.com.cn/api/health"
echo "管理后台: https://admin.yunxixiaochengxu.com.cn"
