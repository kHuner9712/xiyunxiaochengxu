#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE_TAG="${IMAGE_TAG:-baby-mall-api:ci}"
BUILD_SHA="${BUILD_SHA:-${GITHUB_SHA:-}}"
[[ "$BUILD_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "BUILD_SHA must be a 40-character Git SHA" >&2; exit 1; }
export BUILD_SHA

RUN_SUFFIX="${GITHUB_RUN_ID:-$$}"
NETWORK="baby-mall-bootstrap-ci-${RUN_SUFFIX}"
MYSQL_CONTAINER="baby-mall-bootstrap-mysql-${RUN_SUFFIX}"
REDIS_CONTAINER="baby-mall-bootstrap-redis-${RUN_SUFFIX}"
API_CONTAINER="baby-mall-bootstrap-api-${RUN_SUFFIX}"
UPLOAD_VOLUME="baby-mall-bootstrap-upload-${RUN_SUFFIX}"
CERT_DIR="$(mktemp -d)"
DB_NAME="baby_mall_bootstrap"
DB_PASSWORD="Db$(openssl rand -hex 16)"
REDIS_PASSWORD="Redis$(openssl rand -hex 16)"
ADMIN_PASSWORD="A9!$(openssl rand -hex 12)"
JWT_SECRET="$(openssl rand -hex 32)"
REFRESH_SECRET="$(openssl rand -hex 32)"
WECHAT_APP_ID="wx$(openssl rand -hex 8)"
WECHAT_APP_SECRET="$(openssl rand -hex 32)"
WECHAT_MCH_ID="19$(printf '%08d' "$(( (RANDOM * RANDOM) % 100000000 ))")"
WECHAT_MCH_SERIAL_NO="$(openssl rand -hex 16 | tr '[:lower:]' '[:upper:]')"
WECHAT_API_V3_KEY="$(openssl rand -hex 16)"

cleanup() {
  set +e
  docker logs "$API_CONTAINER" > production-bootstrap-api.log 2>&1 || true
  docker rm -f "$API_CONTAINER" "$REDIS_CONTAINER" "$MYSQL_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$UPLOAD_VOLUME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$CERT_DIR"
}
trap cleanup EXIT

openssl genrsa -out "$CERT_DIR/apiclient_key.pem" 2048 >/dev/null 2>&1
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/platform_key.pem" \
  -out "$CERT_DIR/wechatpay_platform.pem" \
  -days 3 \
  -subj '/CN=CI WeChat Platform' >/dev/null 2>&1
PLATFORM_SERIAL="$(openssl x509 -in "$CERT_DIR/wechatpay_platform.pem" -noout -serial | sed 's/^serial=//' | tr -d '[:space:]:' | tr '[:lower:]' '[:upper:]' | sed -E 's/^0+//')"
[[ "$PLATFORM_SERIAL" =~ ^[0-9A-F]+$ ]] || { echo "Cannot derive canonical platform certificate serial" >&2; exit 1; }

docker network create "$NETWORK" >/dev/null
docker volume create "$UPLOAD_VOLUME" >/dev/null

docker run -d \
  --name "$MYSQL_CONTAINER" \
  --network "$NETWORK" \
  --network-alias mysql \
  -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" \
  -e MYSQL_DATABASE="$DB_NAME" \
  mysql:8.0 >/dev/null

mysql_ready=false
for _ in $(seq 1 60); do
  if docker exec "$MYSQL_CONTAINER" mysqladmin ping -h 127.0.0.1 -uroot -p"$DB_PASSWORD" --silent >/dev/null 2>&1; then
    mysql_ready=true
    break
  fi
  sleep 2
done
[ "$mysql_ready" = true ] || { docker logs "$MYSQL_CONTAINER" >&2; echo "Bootstrap MySQL did not become ready" >&2; exit 1; }

docker run -d \
  --name "$REDIS_CONTAINER" \
  --network "$NETWORK" \
  --network-alias redis \
  redis:7-alpine \
  redis-server \
    --appendonly yes \
    --appendfsync everysec \
    --maxmemory-policy noeviction \
    --requirepass "$REDIS_PASSWORD" >/dev/null

redis_ready=false
for _ in $(seq 1 30); do
  if docker exec "$REDIS_CONTAINER" sh -c 'REDISCLI_AUTH="$1" redis-cli ping' sh "$REDIS_PASSWORD" 2>/dev/null | grep -qx PONG; then
    redis_ready=true
    break
  fi
  sleep 1
done
[ "$redis_ready" = true ] || { docker logs "$REDIS_CONTAINER" >&2; echo "Bootstrap Redis did not become ready" >&2; exit 1; }

docker run -d \
  --name "$API_CONTAINER" \
  --network "$NETWORK" \
  -p 127.0.0.1:3101:3000 \
  -v "$CERT_DIR:/app/apps/api/certs:ro" \
  -v "$UPLOAD_VOLUME:/app/apps/api/uploads" \
  -e NODE_ENV=production \
  -e TZ=Asia/Shanghai \
  -e PORT=3000 \
  -e BUILD_SHA="$BUILD_SHA" \
  -e API_DOMAIN=api.yunxixiaochengxu.com.cn \
  -e ADMIN_DOMAIN=admin.yunxixiaochengxu.com.cn \
  -e HTTP_HOST_PORT=80 \
  -e HTTPS_HOST_PORT=443 \
  -e DATABASE_URL="mysql://root:${DB_PASSWORD}@mysql:3306/${DB_NAME}" \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e DB_NAME="$DB_NAME" \
  -e DB_USER=root \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD="$REDIS_PASSWORD" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e REFRESH_TOKEN_SECRET="$REFRESH_SECRET" \
  -e WECHAT_APP_ID="$WECHAT_APP_ID" \
  -e WECHAT_APP_SECRET="$WECHAT_APP_SECRET" \
  -e WECHAT_MCH_ID="$WECHAT_MCH_ID" \
  -e WECHAT_MCH_SERIAL_NO="$WECHAT_MCH_SERIAL_NO" \
  -e WECHAT_API_V3_KEY="$WECHAT_API_V3_KEY" \
  -e WECHAT_PRIVATE_KEY_PATH=/app/apps/api/certs/apiclient_key.pem \
  -e WECHAT_PLATFORM_CERT_PATH=/app/apps/api/certs/wechatpay_platform.pem \
  -e WECHAT_PLATFORM_CERT_SERIAL_NO="$PLATFORM_SERIAL" \
  -e WECHAT_SKIP_VERIFY=false \
  -e WECHAT_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback \
  -e WECHAT_REFUND_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback \
  -e CORS_ORIGINS=https://admin.yunxixiaochengxu.com.cn \
  -e UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn \
  -e UPLOAD_DIR=/app/apps/api/uploads \
  -e ADMIN_DEFAULT_USERNAME=admin \
  -e ADMIN_DEFAULT_PASSWORD="$ADMIN_PASSWORD" \
  -e SMOKE_TEST_BYPASS_CAPTCHA=false \
  -e RUN_SEED=false \
  -e SKIP_MIGRATE=false \
  -e OUTBOUND_HTTP_TIMEOUT_MS=10000 \
  "$IMAGE_TAG" >/dev/null

api_ready=false
for _ in $(seq 1 90); do
  running="$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null || true)"
  [ "$running" = true ] || break
  if curl --fail --silent --show-error http://127.0.0.1:3101/api/health > production-bootstrap-health.json 2>/dev/null; then
    api_ready=true
    break
  fi
  sleep 2
done
if [ "$api_ready" != true ]; then
  docker logs "$API_CONTAINER" >&2 || true
  echo "Final production image failed empty-database bootstrap" >&2
  exit 1
fi

node - <<'NODE'
const fs = require('fs');
const health = JSON.parse(fs.readFileSync('production-bootstrap-health.json', 'utf8'));
if (health.status !== 'ok') throw new Error(`health status=${health.status}`);
if (health.services?.database !== 'ok') throw new Error('database health is not ok');
if (health.services?.redis !== 'ok') throw new Error('redis health is not ok');
if (health.buildSha !== process.env.BUILD_SHA) throw new Error(`build SHA mismatch: ${health.buildSha}`);
NODE

docker exec "$API_CONTAINER" npx prisma migrate status

docker exec -i "$API_CONTAINER" node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const adminCount = await prisma.adminUser.count();
  if (adminCount !== 1) throw new Error(`fresh production bootstrap expected exactly one admin, got ${adminCount}`);
  const admin = await prisma.adminUser.findFirst({ select: { username: true, mustChangePassword: true, deletedAt: true } });
  if (!admin || admin.username !== 'admin') throw new Error('bootstrap admin missing');
  if (admin.mustChangePassword !== true) throw new Error('bootstrap admin must require first-login password change');
  if (admin.deletedAt !== null) throw new Error('bootstrap admin is unexpectedly deleted');
  const type = await prisma.systemConfig.findUnique({ where: { uk_group_key: { groupName: 'customer_service', configKey: 'type' } } });
  const enabled = await prisma.systemConfig.findUnique({ where: { uk_group_key: { groupName: 'customer_service', configKey: 'enabled' } } });
  if (type?.configValue !== 'wechat') throw new Error(`fresh customer service type=${type?.configValue}`);
  if (enabled?.configValue !== 'true') throw new Error(`fresh customer service enabled=${enabled?.configValue}`);
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
NODE

echo "PRODUCTION_BOOTSTRAP_PASS image=$IMAGE_TAG sha=$BUILD_SHA"
