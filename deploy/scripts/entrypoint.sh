#!/bin/sh
set -e

if [ "${NODE_ENV:-}" = "production" ]; then
  echo "生产环境预检: 验证完整运行时与微信支付配置..."
  node dist/config/production-config-preflight.js
fi

if [ $# -gt 0 ]; then
  if [ "${NODE_ENV:-}" = "production" ] \
    && [ "${1:-}" = "npx" ] \
    && [ "${2:-}" = "prisma" ] \
    && [ "${3:-}" = "migrate" ] \
    && [ "${4:-}" = "deploy" ]; then
    pause_dir="${UPLOAD_DIR:-/app/apps/api/uploads}"
    pause_marker="$pause_dir/.scheduler-paused"
    mkdir -p "$pause_dir"
    printf '%s\n' "${BUILD_SHA:-unknown}" > "$pause_marker"
    echo "生产迁移维护模式: 已暂停当前 BUILD_SHA 的 Cron 新任务"

    cleanup_scheduler_pause() {
      rm -f "$pause_marker"
      echo "生产迁移维护模式: 已解除 Cron 暂停标记"
    }
    trap cleanup_scheduler_pause EXIT HUP INT TERM

    # Do not exec the migration command: this shell must stay alive so the EXIT trap removes the
    # shared-volume pause marker on both success and failure. Otherwise a one-off live migration
    # can leave every current/future API instance permanently unable to acquire schedule:* locks.
    "$@"
    exit $?
  fi

  exec "$@"
fi

if [ -d /app/admin-dist ]; then
  rm -rf /usr/share/nginx/admin/*
  cp -a /app/admin-dist/. /usr/share/nginx/admin/
  echo "管理后台静态资源: 已同步到 /usr/share/nginx/admin"
fi

if [ "$NODE_ENV" = "production" ]; then
  if [ "$SKIP_MIGRATE" = "true" ]; then
    echo "SKIP_MIGRATE=true: 跳过数据库迁移"
  else
    echo "数据库迁移: 执行 prisma migrate deploy..."
    npx prisma migrate deploy
  fi
  if [ "$RUN_SEED" = "true" ]; then
    echo "RUN_SEED=true: running database seed..."
    npx prisma db seed
  fi
else
  echo "数据库迁移: 执行 prisma db push..."
  npx prisma db push
  if [ "$RUN_SEED" = "true" ]; then
    echo "RUN_SEED=true: running database seed..."
    npx prisma db seed
  fi
fi

echo "启动服务: node dist/main.js"
exec node dist/main.js