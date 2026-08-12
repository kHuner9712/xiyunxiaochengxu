#!/bin/sh
set -e

if [ "${NODE_ENV:-}" = "production" ]; then
  case "${DB_USER:-}" in
    "")
      echo "生产环境拒绝启动：DB_USER 不能为空" >&2
      exit 1
      ;;
    root)
      echo "生产环境拒绝启动：API 禁止使用 MySQL root 账号，请使用专用业务库用户" >&2
      exit 1
      ;;
  esac

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

run_seed() {
  echo "数据库初始化: running database seed..."
  # Production must execute the complete, audited seed chain explicitly. The indirect Prisma CLI
  # package-metadata seed path did not reliably execute the post-seed permission normalization inside
  # the final production image, which left pickup children attached to the wrong parent on a fresh DB.
  ./node_modules/.bin/ts-node -P prisma/tsconfig.seed.json prisma/seed.ts
  ./node_modules/.bin/ts-node -P prisma/tsconfig.seed.json prisma/seed-default-role-permissions.ts
}

finalize_fresh_production_seed() {
  # The generic seed intentionally leaves phone contact blank. A fresh production install must not
  # start in enabled phone mode with an unusable placeholder because production smoke would reject
  # it before an operator can reach Admin. Default only the fresh install to native WeChat contact;
  # real-device acceptance remains a separate launch gate.
  node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    await prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: 'customer_service', configKey: 'type' } },
      update: { configValue: 'wechat', valueType: 'string' },
      create: {
        groupName: 'customer_service',
        configKey: 'type',
        configValue: 'wechat',
        valueType: 'string',
        description: '客服类型 wechat/phone/both',
      },
    });
    await prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: 'customer_service', configKey: 'enabled' } },
      update: { configValue: 'true', valueType: 'boolean' },
      create: {
        groupName: 'customer_service',
        configKey: 'enabled',
        configValue: 'true',
        valueType: 'boolean',
        description: '客服功能启用',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
  echo "全新生产数据库: 默认启用原生微信客服模式，待真机验收"
}

if [ "$NODE_ENV" = "production" ]; then
  if [ "$SKIP_MIGRATE" = "true" ]; then
    echo "SKIP_MIGRATE=true: 跳过数据库迁移"
  else
    echo "数据库迁移: 执行 prisma migrate deploy..."
    npx prisma migrate deploy
  fi

  admin_count="$(node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const count = await prisma.adminUser.count();
    process.stdout.write(String(count));
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
)"
  case "$admin_count" in
    ''|*[!0-9]*)
      echo "生产数据库管理员数量检查返回非法结果: $admin_count" >&2
      exit 1
      ;;
  esac

  if [ "$admin_count" = "0" ]; then
    echo "检测到全新生产数据库（admin_users=0），执行首次安全初始化"
    run_seed
    finalize_fresh_production_seed
  elif [ "$RUN_SEED" = "true" ]; then
    echo "RUN_SEED=true: 显式执行幂等数据库 seed"
    run_seed
  else
    echo "检测到已有管理员账号（admin_users=$admin_count），跳过自动 seed"
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