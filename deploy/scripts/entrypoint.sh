#!/bin/sh
set -e

if [ $# -gt 0 ]; then
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
node dist/main.js
