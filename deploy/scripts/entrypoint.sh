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

wait_for_scheduler_drain() {
  echo "生产迁移维护模式: 等待已进入的 Cron 写任务排空..."
  node - <<'NODE'
const Redis = require('ioredis');

const host = process.env.REDIS_HOST || 'redis';
const port = Number(process.env.REDIS_PORT || 6379);
const password = process.env.REDIS_PASSWORD || undefined;
const timeoutMs = 15 * 60 * 1000;
const pollMs = 1000;
const deadline = Date.now() + timeoutMs;
const redis = new Redis({
  host,
  port,
  password,
  lazyConnect: true,
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
});

async function listScheduleLocks() {
  let cursor = '0';
  const keys = [];
  do {
    const result = await redis.scan(cursor, 'MATCH', 'schedule:*', 'COUNT', 200);
    cursor = String(result?.[0] ?? '0');
    if (Array.isArray(result?.[1])) keys.push(...result[1]);
  } while (cursor !== '0');
  return keys;
}

(async () => {
  await redis.connect();
  for (;;) {
    const keys = await listScheduleLocks();
    if (keys.length === 0) {
      console.log('生产迁移维护模式: 已有 Cron 写任务已全部排空');
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(`等待 Cron 写任务排空超时，仍持有调度锁: ${keys.sort().join(', ')}`);
    }
    console.log(`生产迁移维护模式: 仍有 ${keys.length} 个 Cron 锁，继续等待`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
})()
  .catch((error) => {
    console.error(`生产迁移维护模式: Cron 排空失败: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    redis.disconnect();
  });
NODE
}

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
    echo "生产迁移维护模式: 已暂停所有在线 API 构建获取新的 Cron 锁"

    cleanup_scheduler_pause() {
      rm -f "$pause_marker"
      echo "生产迁移维护模式: 已解除 Cron 暂停标记"
    }
    trap cleanup_scheduler_pause EXIT HUP INT TERM

    # The shared marker stops new schedule:* locks. Wait until locks held by tasks that entered just
    # before the marker was published have disappeared before touching the live schema. Redis is the
    # durable cross-process observation point because every Cron job owns one of these tokenized,
    # heartbeated locks for its full execution.
    wait_for_scheduler_drain

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

run_permission_seed() {
  echo "数据库权限初始化: running safe role/permission seed..."
  ./node_modules/.bin/ts-node -P prisma/tsconfig.seed.json prisma/seed-default-role-permissions.ts
}

run_seed() {
  echo "数据库初始化: running database seed..."
  # The full seed contains business defaults and is safe only for a genuinely fresh production DB.
  # Never run it against an initialized production database: SystemConfig values are operator-owned
  # runtime state and must survive image restarts and deployments.
  ./node_modules/.bin/ts-node -P prisma/tsconfig.seed.json prisma/seed.ts
  run_permission_seed
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
  else
    if [ "${RUN_SEED:-false}" = "true" ]; then
      echo "生产环境拒绝启动：已有数据的生产库禁止 RUN_SEED=true；完整 seed 会覆盖运营 SystemConfig。请通过管理后台修改业务配置，权限补齐会自动安全执行。" >&2
      exit 1
    fi
    echo "检测到已有管理员账号（admin_users=$admin_count），跳过完整业务 seed，保留运营配置"
    run_permission_seed
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