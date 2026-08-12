#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE_NAME="${1:-baby-mall-api:ci}"
BOOTSTRAP_DB="baby_mall_bootstrap"
BOOTSTRAP_REDIS_NAME="baby-mall-bootstrap-redis"
BOOTSTRAP_API_NAME="baby-mall-bootstrap-api"
BOOTSTRAP_ADMIN_VOLUME="baby-mall-bootstrap-admin-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
BOOTSTRAP_REDIS_PORT="6380"
BOOTSTRAP_API_PORT="3200"
REDIS_PASSWORD="BootstrapRedis#2026-Strong"
ADMIN_USERNAME="ci_production_container_admin"
ADMIN_PASSWORD='C!7xK2vR9mQ4zT6p'
EXPECTED_SERIAL="ABCDEF123456"
EXPECTED_BUILD_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
API_DOMAIN="api.yunxixiaochengxu.com.cn"
ADMIN_DOMAIN="admin.yunxixiaochengxu.com.cn"
FIXTURE_DIR="$(mktemp -d)"
LOG_FILE="${FIXTURE_DIR}/bootstrap-api.log"

mysql_client() {
  docker run --rm --network host mysql:8.0 \
    mysql -h127.0.0.1 -P3306 -uroot -proot "$@"
}

cleanup() {
  docker rm -f "$BOOTSTRAP_API_NAME" >/dev/null 2>&1 || true
  docker rm -f "$BOOTSTRAP_REDIS_NAME" >/dev/null 2>&1 || true
  docker volume rm -f "$BOOTSTRAP_ADMIN_VOLUME" >/dev/null 2>&1 || true
  mysql_client -e "DROP DATABASE IF EXISTS \`${BOOTSTRAP_DB}\`;" >/dev/null 2>&1 || true
  rm -rf "$FIXTURE_DIR"
}
trap cleanup EXIT

command -v docker >/dev/null 2>&1 || { echo 'docker is required' >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo 'openssl is required' >&2; exit 1; }
docker image inspect "$IMAGE_NAME" >/dev/null 2>&1 || { echo "production image not found: $IMAGE_NAME" >&2; exit 1; }
[[ "$EXPECTED_BUILD_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "bootstrap BUILD_SHA must be an exact 40-character SHA: $EXPECTED_BUILD_SHA" >&2; exit 1; }

docker volume rm -f "$BOOTSTRAP_ADMIN_VOLUME" >/dev/null 2>&1 || true
docker volume create "$BOOTSTRAP_ADMIN_VOLUME" >/dev/null

# Use a separate database so this test proves the image can bootstrap a genuinely empty production
# schema without mutating the normal CI integration database.
mysql_client -e "DROP DATABASE IF EXISTS \`${BOOTSTRAP_DB}\`; CREATE DATABASE \`${BOOTSTRAP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Production health rejects Redis correctness drift, so the bootstrap dependency deliberately uses
# the same persistence/eviction contract as the production redis.conf rather than a loose test Redis.
docker run -d --rm \
  --name "$BOOTSTRAP_REDIS_NAME" \
  --network host \
  redis:7-alpine \
  redis-server \
  --port "$BOOTSTRAP_REDIS_PORT" \
  --requirepass "$REDIS_PASSWORD" \
  --appendonly yes \
  --appendfsync everysec \
  --maxmemory-policy noeviction >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$BOOTSTRAP_REDIS_NAME" redis-cli -p "$BOOTSTRAP_REDIS_PORT" -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -qx PONG; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo 'bootstrap Redis did not become ready' >&2
    docker logs "$BOOTSTRAP_REDIS_NAME" >&2 || true
    exit 1
  fi
  sleep 1
done

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -nodes \
  -keyout "$FIXTURE_DIR/merchant-private-key.pem" \
  -out "$FIXTURE_DIR/wechatpay-platform.pem" \
  -subj '/CN=WeChat Pay Container Bootstrap Fixture' \
  -days 30 \
  -set_serial "0x${EXPECTED_SERIAL}" >/dev/null 2>&1

container_id="$({
  docker run -d \
    --name "$BOOTSTRAP_API_NAME" \
    --network host \
    -v "$FIXTURE_DIR:/run/bootstrap-fixture:ro" \
    -v "$BOOTSTRAP_ADMIN_VOLUME:/usr/share/nginx/admin" \
    -e NODE_ENV=production \
    -e PORT="$BOOTSTRAP_API_PORT" \
    -e BUILD_SHA="$EXPECTED_BUILD_SHA" \
    -e API_DOMAIN="$API_DOMAIN" \
    -e ADMIN_DOMAIN="$ADMIN_DOMAIN" \
    -e HTTP_HOST_PORT=80 \
    -e HTTPS_HOST_PORT=443 \
    -e DB_HOST=127.0.0.1 \
    -e DB_PORT=3306 \
    -e DB_NAME="$BOOTSTRAP_DB" \
    -e DB_USER=root \
    -e DB_PASSWORD=root \
    -e DATABASE_URL="mysql://root:root@127.0.0.1:3306/${BOOTSTRAP_DB}" \
    -e REDIS_HOST=127.0.0.1 \
    -e REDIS_PORT="$BOOTSTRAP_REDIS_PORT" \
    -e REDIS_PASSWORD="$REDIS_PASSWORD" \
    -e REDIS_DB=0 \
    -e JWT_SECRET='Z7mQ2xL9vR4nC8pK6sW3hF5jT1yB0dEe' \
    -e REFRESH_TOKEN_SECRET='Q6rN4vK8pC2xM9sW5hF7jL1yT3bD0eAa' \
    -e WECHAT_APP_ID='wxe40f76a33427090f' \
    -e WECHAT_APP_SECRET='wx-container-bootstrap-app-secret' \
    -e WECHAT_MCH_ID='1900000001' \
    -e WECHAT_MCH_SERIAL_NO='A1B2C3D4E5F60708' \
    -e WECHAT_API_V3_KEY='0123456789ABCDEF0123456789ABCDEF' \
    -e WECHAT_PRIVATE_KEY_PATH='/run/bootstrap-fixture/merchant-private-key.pem' \
    -e WECHAT_PLATFORM_CERT_PATH='/run/bootstrap-fixture/wechatpay-platform.pem' \
    -e WECHAT_PLATFORM_CERT_SERIAL_NO="$EXPECTED_SERIAL" \
    -e WECHAT_NOTIFY_URL="https://${API_DOMAIN}/api/weapp/pay/callback" \
    -e WECHAT_REFUND_NOTIFY_URL="https://${API_DOMAIN}/api/weapp/pay/refund-callback" \
    -e WECHAT_SKIP_VERIFY=false \
    -e UPLOAD_PUBLIC_URL="https://${API_DOMAIN}" \
    -e CORS_ORIGINS="https://${ADMIN_DOMAIN}" \
    -e OUTBOUND_HTTP_TIMEOUT_MS=10000 \
    -e SMOKE_TEST_BYPASS_CAPTCHA=false \
    -e ADMIN_DEFAULT_USERNAME="$ADMIN_USERNAME" \
    -e ADMIN_DEFAULT_PASSWORD="$ADMIN_PASSWORD" \
    -e RUN_SEED=false \
    -e SKIP_MIGRATE=false \
    "$IMAGE_NAME"
} 2>&1)" || {
  echo "failed to start bootstrap API container: $container_id" >&2
  exit 1
}

healthy=0
for attempt in $(seq 1 120); do
  docker logs "$BOOTSTRAP_API_NAME" > "$LOG_FILE" 2>&1 || true
  if ! docker inspect --format '{{.State.Running}}' "$BOOTSTRAP_API_NAME" 2>/dev/null | grep -qx true; then
    echo 'production bootstrap container exited before becoming healthy' >&2
    cat "$LOG_FILE" >&2
    exit 1
  fi
  if curl --silent --show-error --fail "http://127.0.0.1:${BOOTSTRAP_API_PORT}/api/health" > "$FIXTURE_DIR/health.json" 2>/dev/null; then
    if node -e '
      const fs = require("fs");
      const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (body.status !== "ok" || body.services?.database !== "ok" || body.services?.redis !== "ok") process.exit(1);
    ' "$FIXTURE_DIR/health.json"; then
      healthy=1
      break
    fi
  fi
  sleep 1
done
if [ "$healthy" -ne 1 ]; then
  echo 'fresh production container did not become healthy' >&2
  cat "$LOG_FILE" >&2
  exit 1
fi

for marker in \
  'PRODUCTION_CONFIG_PREFLIGHT_PASS' \
  '数据库迁移: 执行 prisma migrate deploy' \
  '检测到全新生产数据库（admin_users=0），执行首次安全初始化' \
  '数据库初始化: running database seed' \
  '全新生产数据库: 默认启用原生微信客服模式'; do
  grep -Fq "$marker" "$LOG_FILE" || {
    echo "fresh bootstrap log is missing expected marker: $marker" >&2
    cat "$LOG_FILE" >&2
    exit 1
  }
done

admin_build_sha="$(docker run --rm \
  --entrypoint cat \
  -v "$BOOTSTRAP_ADMIN_VOLUME:/usr/share/nginx/admin:ro" \
  "$IMAGE_NAME" \
  /usr/share/nginx/admin/.build-hash 2>/dev/null | tr -d '\r\n')"
[ "$admin_build_sha" = "$EXPECTED_BUILD_SHA" ] || {
  echo "fresh production admin volume build hash mismatch: expected=$EXPECTED_BUILD_SHA actual=${admin_build_sha:-missing}" >&2
  exit 1
}

admin_state="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT CONCAT(COUNT(*), ':', COALESCE(MAX(must_change_password), 0), ':', COALESCE(MAX(status), 0))
  FROM admin_users
  WHERE username = '${ADMIN_USERNAME}' AND deleted_at IS NULL;
")"
[ "$admin_state" = '1:1:1' ] || {
  echo "bootstrap admin state mismatch: $admin_state" >&2
  exit 1
}

role_count="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT COUNT(*)
  FROM admin_user_roles aur
  JOIN admin_users au ON au.id = aur.admin_user_id
  JOIN admin_roles ar ON ar.id = aur.role_id
  WHERE au.username = '${ADMIN_USERNAME}' AND ar.code = 'super_admin' AND ar.status = 1;
")"
[ "$role_count" = '1' ] || {
  echo "bootstrap admin is not assigned to active super_admin: $role_count" >&2
  exit 1
}

pickup_tree_state="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT CONCAT(
    SUM(p.code = 'pickup' AND p.parent_id = 0), ':',
    SUM(p.code IN ('pickup:store', 'pickup:verify') AND p.parent_id = parent.id)
  )
  FROM admin_permissions p
  LEFT JOIN admin_permissions parent ON parent.code = 'pickup'
  WHERE p.code IN ('pickup', 'pickup:store', 'pickup:verify');
")"
[ "$pickup_tree_state" = '1:2' ] || {
  echo "fresh production pickup permission hierarchy mismatch: $pickup_tree_state" >&2
  exit 1
}

merchant_settlement_parent_count="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT COUNT(*)
  FROM admin_permissions child
  JOIN admin_permissions parent ON parent.id = child.parent_id
  WHERE child.code = 'order:merchant-settlement' AND parent.code = 'order';
")"
[ "$merchant_settlement_parent_count" = '1' ] || {
  echo "fresh production merchant settlement permission is not under order: $merchant_settlement_parent_count" >&2
  exit 1
}

for role_code in operator cs finance; do
  permission_count="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
    SELECT COUNT(*)
    FROM admin_roles ar
    JOIN admin_role_permissions arp ON arp.role_id = ar.id
    WHERE ar.code = '${role_code}' AND ar.status = 1;
  ")"
  if ! [[ "$permission_count" =~ ^[1-9][0-9]*$ ]]; then
    echo "fresh production default role has no permissions: role=${role_code} count=${permission_count}" >&2
    exit 1
  fi
done

finance_settlement_count="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT COUNT(*)
  FROM admin_roles ar
  JOIN admin_role_permissions arp ON arp.role_id = ar.id
  JOIN admin_permissions p ON p.id = arp.permission_id
  WHERE ar.code = 'finance' AND ar.status = 1 AND p.code = 'order:merchant-settlement';
")"
[ "$finance_settlement_count" = '1' ] || {
  echo "fresh production finance role lacks merchant settlement permission: $finance_settlement_count" >&2
  exit 1
}

pickup_parent_role_gaps="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT COUNT(*)
  FROM admin_roles ar
  WHERE ar.status = 1
    AND EXISTS (
      SELECT 1
      FROM admin_role_permissions arp
      JOIN admin_permissions p ON p.id = arp.permission_id
      WHERE arp.role_id = ar.id AND p.code IN ('pickup:store', 'pickup:verify')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM admin_role_permissions arp
      JOIN admin_permissions p ON p.id = arp.permission_id
      WHERE arp.role_id = ar.id AND p.code = 'pickup'
    );
")"
[ "$pickup_parent_role_gaps" = '0' ] || {
  echo "fresh production role has pickup child permission without pickup parent: $pickup_parent_role_gaps" >&2
  exit 1
}

customer_service_type="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "
  SELECT config_value
  FROM system_configs
  WHERE group_name = 'customer_service' AND config_key = 'type'
  LIMIT 1;
")"
[ "$customer_service_type" = 'wechat' ] || {
  echo "fresh production customer service type mismatch: $customer_service_type" >&2
  exit 1
}

migration_count="$(mysql_client -N -B "$BOOTSTRAP_DB" -e "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
if ! [[ "$migration_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "fresh production bootstrap did not apply migrations: $migration_count" >&2
  exit 1
fi

# Ensure the actual image can also terminate cleanly after the fresh bootstrap path.
docker stop --time 25 "$BOOTSTRAP_API_NAME" >/dev/null
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$BOOTSTRAP_API_NAME")"
[ "$exit_code" = '0' ] || [ "$exit_code" = '143' ] || {
  echo "bootstrap API exited unexpectedly after SIGTERM: $exit_code" >&2
  docker logs "$BOOTSTRAP_API_NAME" >&2 || true
  exit 1
}

echo "[production-container-bootstrap] PASS migrations=${migration_count} admin=${ADMIN_USERNAME} build=${EXPECTED_BUILD_SHA}"
