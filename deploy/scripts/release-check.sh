#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
WARN=0

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

REQUIRE_REAL_WX_APPID_CHECK="${REQUIRE_REAL_WX_APPID:-}"
STRICT_PROD_GATE=false
CODE_FREEZE_GATE=false
while [ $# -gt 0 ]; do
  case "$1" in
    --code-freeze-gate)
      CODE_FREEZE_GATE=true
      ;;
    --require-real-wx-appid)
      REQUIRE_REAL_WX_APPID_CHECK="true"
      ;;
    --strict-prod-gate)
      STRICT_PROD_GATE=true
      ;;
  esac
  shift
done

IS_WINDOWS=false
if [ -n "${WINDIR:-}" ] || [ -n "${MSYSTEM:-}" ] || uname -r 2>/dev/null | grep -qi microsoft; then
  IS_WINDOWS=true
fi

if [ "$IS_WINDOWS" = true ]; then
  run_pnpm() {
    cmd.exe /c "pnpm $*" > "$TMPFILE" 2>&1
  }
  run_node() {
    cmd.exe /c "node $*" > "$TMPFILE" 2>&1
  }
else
  run_pnpm() {
    pnpm "$@" > "$TMPFILE" 2>&1
  }
  run_node() {
    node "$@" > "$TMPFILE" 2>&1
  }
fi

run_pnpm_with_node_env() {
  local node_env_value="$1"
  shift

  if [ "$IS_WINDOWS" = true ]; then
    cmd.exe /c "set NODE_ENV=$node_env_value&& pnpm $*" > "$TMPFILE" 2>&1
  else
    NODE_ENV="$node_env_value" pnpm "$@" > "$TMPFILE" 2>&1
  fi
}

TMPFILE="${TMPDIR:-/tmp}/release-check-$$.log"
trap "rm -f '$TMPFILE'" EXIT

pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓ PASS${NC} $1"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}✗ FAIL${NC} $1"; }
skip() { SKIP=$((SKIP + 1)); echo -e "  ${CYAN}⊘ SKIP${NC} $1"; }
warn() { WARN=$((WARN + 1)); echo -e "  ${YELLOW}⚠ WARN${NC} $1"; }

section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║   禧孕小程序 Release Gate Check          ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

section "0. 冻结入口与依赖锁定检查"
if [ "$CODE_FREEZE_GATE" = "true" ]; then
  pass "当前执行 Code Freeze Gate；人工/部署项仅作为 WARN，正式上线仍必须执行 pnpm release:check:prod"
elif [ "$STRICT_PROD_GATE" = "true" ]; then
  pass "当前执行 strict prod gate；公开仓库只复核代码门禁与脚本可执行性，生产运行与真机验收需另行留痕"
else
  warn "当前不是 Code Freeze Gate 或 strict prod gate；预生产前请执行 pnpm release:check:freeze，正式上线前请执行 pnpm release:check:prod"
fi

if run_pnpm install --frozen-lockfile; then
  pass "pnpm install --frozen-lockfile 通过，lockfile 与 package.json 同步"
else
  fail "pnpm install --frozen-lockfile 失败，请先执行 pnpm install 并提交 pnpm-lock.yaml"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

if run_pnpm list -r --depth -1; then
  pass "workspace 包可完整解析"
else
  fail "workspace 包解析失败，请检查 pnpm-workspace.yaml 与依赖声明"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

if run_node deploy/scripts/check-miniprogram.mjs; then
  pass "小程序 DCloud 锁定、路由、页面、tabBar 与包大小检查通过"
else
  fail "小程序 DCloud 锁定、路由、页面、tabBar 或包大小检查失败"
  tail -20 "$TMPFILE" | sed 's/^/    /'
fi

section "1. Prisma Schema 验证"
if run_pnpm --filter @baby-mall/api prisma:validate; then
  pass "prisma:validate 通过"
else
  fail "prisma:validate 失败，请检查 schema.prisma"
  tail -5 "$TMPFILE" | sed 's/^/    /'
fi

section "1.5 Prisma 迁移 Dry-run"
if [ -z "${DRY_RUN_DATABASE_URL:-}" ]; then
  if [ "$STRICT_PROD_GATE" = "true" ] || [ "${NODE_ENV:-}" = "production" ]; then
    warn "未提供 DRY_RUN_DATABASE_URL；公开仓库不复核私有数据库连接，生产数据库迁移结果需在服务器留痕"
  else
    warn "未提供 DRY_RUN_DATABASE_URL，跳过 migrate deploy dry-run"
  fi
elif run_pnpm prisma:migrate:dry-run; then
  pass "prisma migrate deploy dry-run 通过"
else
  fail "prisma migrate deploy dry-run 失败"
  tail -20 "$TMPFILE" | sed 's/^/    /'
fi

section "2. API 测试 (unit + e2e)"
if run_pnpm --filter @baby-mall/api test:ci; then
  pass "test:ci 通过"
else
  fail "test:ci 失败，请检查测试输出"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

section "2.5 API Lint 与权限审计"
if run_pnpm --filter @baby-mall/api lint; then
  pass "API lint 通过"
else
  fail "API lint 失败"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

if run_node deploy/scripts/audit-api-permissions.mjs; then
  pass "API @Public / admin permission / weapp CurrentUser 审计通过"
else
  fail "API 权限与越权静态审计失败"
  tail -30 "$TMPFILE" | sed 's/^/    /'
fi

if run_node --test deploy/scripts/audit-api-permissions.test.mjs; then
  pass "API 权限审计 fixture 测试通过"
else
  fail "API 权限审计 fixture 测试失败"
  tail -30 "$TMPFILE" | sed 's/^/    /'
fi

if run_node --test deploy/scripts/release-check.test.mjs; then
  pass "Release gate 入口与结论输出测试通过"
else
  fail "Release gate 入口与结论输出测试失败"
  tail -30 "$TMPFILE" | sed 's/^/    /'
fi

section "3. API 构建"
if run_pnpm build:api; then
  pass "build:api 通过"
else
  fail "build:api 失败"
  tail -5 "$TMPFILE" | sed 's/^/    /'
fi

section "3.5 Admin Web Lint 与类型检查"
if run_pnpm --filter @baby-mall/admin-web lint; then
  pass "admin-web lint 通过"
else
  fail "admin-web lint 失败"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

if run_pnpm --filter @baby-mall/admin-web typecheck; then
  pass "admin-web typecheck 通过"
else
  fail "admin-web typecheck 失败"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

section "4. Admin Web 构建"
if run_pnpm build:admin; then
  pass "build:admin 通过"
else
  fail "build:admin 失败"
  tail -5 "$TMPFILE" | sed 's/^/    /'
fi

section "4.5 小程序 TypeScript 与构建"
if run_pnpm --filter @baby-mall/miniprogram typecheck; then
  pass "miniprogram typecheck 通过"
else
  fail "miniprogram typecheck 失败"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

MINI_BUILD_SCRIPT="build:mini"
MINI_BUILD_PUBLIC_MODE=false
if [ "$STRICT_PROD_GATE" = "true" ] || [ "${NODE_ENV:-}" = "production" ]; then
  if [ -n "${VITE_WX_APPID:-}" ] && [ -n "${VITE_API_BASE_URL:-}" ]; then
    MINI_BUILD_SCRIPT="build:mini:prod"
  else
    MINI_BUILD_PUBLIC_MODE=true
    warn "未同时提供 VITE_WX_APPID 与 VITE_API_BASE_URL；公开仓库门禁执行 build:mini，真实生产小程序产物需在服务器私有环境执行 build:mini:prod 并上传体验版留痕"
  fi
fi

run_mini_build_gate() {
  if [ "$MINI_BUILD_PUBLIC_MODE" = "true" ]; then
    run_pnpm_with_node_env development "$MINI_BUILD_SCRIPT"
    return "$?"
  fi

  run_pnpm "$MINI_BUILD_SCRIPT"
}

if run_mini_build_gate; then
  pass "$MINI_BUILD_SCRIPT 通过"
else
  fail "$MINI_BUILD_SCRIPT 失败，商用上线前小程序构建必须通过"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

if run_node deploy/scripts/check-miniprogram.mjs; then
  pass "小程序构建产物包大小检查通过"
else
  fail "小程序构建产物包大小检查失败"
  tail -20 "$TMPFILE" | sed 's/^/    /'
fi

section "5. 敏感文件未提交检查"
SENSITIVE_FILES=(".env" ".env.local" ".env.production.local" ".env.staging.local")
for f in "${SENSITIVE_FILES[@]}"; do
  if git ls-files --error-unmatch "$f" > /dev/null 2>&1; then
    fail "敏感文件 $f 已被 git 追踪，请从版本控制中移除"
  else
    pass "敏感文件 $f 未被 git 追踪"
  fi
done

CERT_PATTERNS=("*.pem" "*.key" "*.p12" "*.pfx" "*.crt")
for pattern in "${CERT_PATTERNS[@]}"; do
  tracked=$(git ls-files "$pattern" 2>/dev/null || true)
  if [ -n "$tracked" ]; then
    fail "证书/密钥文件被 git 追踪: $tracked"
  else
    pass "证书/密钥文件 ($pattern) 未被 git 追踪"
  fi
done

CERT_DIRS=("deploy/certs" "certs" "secrets")
for d in "${CERT_DIRS[@]}"; do
  if [ -d "$d" ]; then
    tracked=$(git ls-files "$d" 2>/dev/null | grep -v '\.gitkeep$' | grep -v 'README\.md$' || true)
    if [ -n "$tracked" ]; then
      fail "证书目录 $d 中有被追踪的敏感文件: $tracked"
    else
      pass "证书目录 $d 无敏感文件被 git 追踪"
    fi
  fi
done

section "5.5. 生产环境弱密钥检查"
WEAK_DEFAULTS=("baby_mall_2024" "change_this_jwt_secret" "your_jwt_secret_key_change_this" "your_admin_password_change_this" "your_db_password")
for weak in "${WEAK_DEFAULTS[@]}"; do
  if grep -rq "$weak" deploy/docker-compose.yml .env.example 2>/dev/null; then
    warn "发现弱默认值 '$weak' 在配置文件中（仅作为示例默认值，生产环境必须覆盖）"
  fi
done

section "6. 数据库迁移文件检查"
MIGRATION_DIR="apps/api/prisma/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  pass "迁移目录 $MIGRATION_DIR 存在"
  migration_count=$(find "$MIGRATION_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  pass "共 $migration_count 个迁移文件"
else
  fail "迁移目录 $MIGRATION_DIR 不存在"
fi

section "7. Schema 与 Migration 关键字段一致性"

SCHEMA_FILE="apps/api/prisma/schema.prisma"

check_model_in_schema() {
  local model_name="$1"
  if grep -q "model $model_name" "$SCHEMA_FILE" 2>/dev/null; then
    pass "schema.prisma 包含 model $model_name"
  else
    fail "schema.prisma 缺少 model $model_name"
  fi
}

check_field_in_schema() {
  local model_name="$1"
  local field_pattern="$2"
  local desc="$3"
  if grep -A 30 "model $model_name" "$SCHEMA_FILE" 2>/dev/null | grep -q "$field_pattern"; then
    pass "$desc"
  else
    fail "$desc (在 model $model_name 中未找到 $field_pattern)"
  fi
}

check_enum_in_schema() {
  local enum_name="$1"
  local value="$2"
  local desc="$3"
  if grep -A 20 "enum $enum_name" "$SCHEMA_FILE" 2>/dev/null | grep -q "$value"; then
    pass "$desc"
  else
    fail "$desc (enum $enum_name 中未找到 $value)"
  fi
}

if [ -f "$SCHEMA_FILE" ]; then
  check_model_in_schema "OrderRefund"
  check_model_in_schema "RefundCallbackLog"
  check_model_in_schema "BusinessEvent"
  check_model_in_schema "PaymentCompensationTask"
  check_field_in_schema "OrderRefund" "outRefundNo" "OrderRefund.outRefundNo 字段"
  check_field_in_schema "OrderRefund" "initiating" "OrderRefund.status 包含 initiating 默认值"
  check_field_in_schema "RefundCallbackLog" "orphan" "RefundCallbackLog.status 包含 orphan"
  check_field_in_schema "ProductCategory" "complianceConfig" "ProductCategory.complianceConfig 字段"
  check_field_in_schema "PaymentCompensationTask" "transactionId" "PaymentCompensationTask.transactionId 字段"
  check_field_in_schema "PaymentCompensationTask" "callbackPayload" "PaymentCompensationTask.callbackPayload 字段"
  check_field_in_schema "PaymentCompensationTask" "status" "PaymentCompensationTask.status 字段"
  check_field_in_schema "PaymentCompensationTask" "@db.Text @map(\"resolution\")" "PaymentCompensationTask.resolution 为 Text"
  check_field_in_schema "PaymentCompensationTask" "uk_compensation_order_reason_tx" "PaymentCompensationTask 复合唯一约束"
  check_enum_in_schema "AftersaleStatus" "pending_refund" "AftersaleStatus 包含 pending_refund"
else
  fail "schema.prisma 不存在: $SCHEMA_FILE"
fi

if grep -R "payment_compensation_tasks" apps/api/prisma/migrations/*/migration.sql > /dev/null 2>&1; then
  pass "迁移文件包含 payment_compensation_tasks"
else
  fail "迁移文件缺少 payment_compensation_tasks"
fi

section "8. .env.example 必要变量检查"
ENV_EXAMPLE=".env.example"
REQUIRED_VARS=(
  "DATABASE_URL"
  "REDIS_HOST"
  "JWT_SECRET"
  "REFRESH_TOKEN_SECRET"
  "WECHAT_APP_ID"
  "WECHAT_APP_SECRET"
  "WECHAT_MCH_ID"
  "WECHAT_MCH_SERIAL_NO"
  "WECHAT_API_V3_KEY"
  "WECHAT_PRIVATE_KEY_PATH"
  "WECHAT_PLATFORM_CERT_PATH"
  "WECHAT_PLATFORM_CERT_SERIAL_NO"
  "WECHAT_NOTIFY_URL"
  "WECHAT_REFUND_NOTIFY_URL"
  "UPLOAD_PUBLIC_URL"
  "CORS_ORIGINS"
)

if [ -f "$ENV_EXAMPLE" ]; then
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "$var" "$ENV_EXAMPLE" 2>/dev/null; then
      pass ".env.example 包含 $var"
    else
      fail ".env.example 缺少 $var（生产部署必需）"
    fi
  done
else
  fail ".env.example 不存在"
fi

section "8.45. API 路径一致性检查"
MAIN_TS_FILE="apps/api/src/main.ts"
if [ -f "$MAIN_TS_FILE" ]; then
  if grep -q "setGlobalPrefix('api')" "$MAIN_TS_FILE" 2>/dev/null; then
    pass "main.ts setGlobalPrefix 为 'api'，与 Nginx 和前端配置一致"
  else
    fail "main.ts setGlobalPrefix 不是 'api'，Nginx 代理和前端 baseURL 将无法正确路由"
  fi
else
  fail "main.ts 不存在: $MAIN_TS_FILE"
fi

section "8.5. Docker Compose 退款回调 URL 检查"
COMPOSE_FILES=("deploy/docker-compose.yml" "deploy/docker-compose.bt.yml")
for compose_file in "${COMPOSE_FILES[@]}"; do
  if [ -f "$compose_file" ]; then
    if grep -q "WECHAT_REFUND_NOTIFY_URL" "$compose_file" 2>/dev/null; then
      pass "$compose_file 包含 WECHAT_REFUND_NOTIFY_URL"
    else
      fail "$compose_file 缺少 WECHAT_REFUND_NOTIFY_URL，微信退款回调将无法到达服务"
    fi
  else
    warn "$compose_file 不存在，跳过检查"
  fi
done

section "8.55. Docker Compose 必要变量检查"
REQUIRED_COMPOSE_VARS=(
  "DATABASE_URL"
  "REDIS_HOST"
  "JWT_SECRET"
  "REFRESH_TOKEN_SECRET"
  "WECHAT_APP_ID"
  "WECHAT_APP_SECRET"
  "WECHAT_MCH_ID"
  "WECHAT_MCH_SERIAL_NO"
  "WECHAT_API_V3_KEY"
  "WECHAT_PRIVATE_KEY_PATH"
  "WECHAT_PLATFORM_CERT_PATH"
  "WECHAT_PLATFORM_CERT_SERIAL_NO"
  "WECHAT_NOTIFY_URL"
  "WECHAT_REFUND_NOTIFY_URL"
  "UPLOAD_PUBLIC_URL"
  "CORS_ORIGINS"
)
for compose_file in "${COMPOSE_FILES[@]}"; do
  if [ ! -f "$compose_file" ]; then
    fail "$compose_file 不存在，无法校验 Compose 变量完整性"
    continue
  fi
  for var in "${REQUIRED_COMPOSE_VARS[@]}"; do
    if grep -q "$var" "$compose_file" 2>/dev/null; then
      pass "$compose_file 包含 $var"
    else
      fail "$compose_file 缺少 $var（部署时将导致运行失败或能力缺失）"
    fi
  done
done

section "8.56. 订单导出接口与权限一致性检查"
ORDER_CONTROLLER_FILE="apps/api/src/order/order.controller.ts"
ORDER_ADMIN_LIST_FILE="apps/admin-web/src/views/order/list.vue"
if [ -f "$ORDER_CONTROLLER_FILE" ]; then
  if grep -q "@Get('export')" "$ORDER_CONTROLLER_FILE" 2>/dev/null; then
    pass "后端存在 /admin/order/export 接口"
  else
    fail "后端缺少 /admin/order/export 接口"
  fi
  if grep -q "@RequirePermission('order:export')" "$ORDER_CONTROLLER_FILE" 2>/dev/null; then
    pass "后端导出接口权限为 order:export"
  else
    fail "后端导出接口权限不是 order:export"
  fi
  if grep -q "text/csv; charset=utf-8" "$ORDER_CONTROLLER_FILE" 2>/dev/null; then
    pass "后端导出接口返回 CSV Content-Type"
  else
    fail "后端导出接口未设置 CSV Content-Type"
  fi
  if grep -q "orders-.*\\.csv" "$ORDER_CONTROLLER_FILE" 2>/dev/null || grep -q "orders-" "$ORDER_CONTROLLER_FILE" 2>/dev/null; then
    pass "后端导出文件名使用 .csv"
  else
    fail "后端导出文件名未使用 .csv"
  fi
else
  fail "找不到后端订单控制器文件: $ORDER_CONTROLLER_FILE"
fi

if [ -f "$ORDER_ADMIN_LIST_FILE" ]; then
  if grep -q "v-permission=\"'order:export'\"" "$ORDER_ADMIN_LIST_FILE" 2>/dev/null; then
    pass "前端导出按钮权限为 order:export"
  else
    fail "前端导出按钮权限不是 order:export"
  fi
else
  fail "找不到后台订单列表页面: $ORDER_ADMIN_LIST_FILE"
fi

section "8.6. 小程序 AppID 检查"
MANIFEST_FILE="apps/miniprogram/src/manifest.json"
WX_APPID_PATTERN='^wx[a-zA-Z0-9]{16}$'
if [ -f "$MANIFEST_FILE" ]; then
  ENFORCE_REAL_APPID=false
  if [ "$REQUIRE_REAL_WX_APPID_CHECK" = "true" ] || [ "$STRICT_PROD_GATE" = "true" ] || [ "${NODE_ENV:-}" = "production" ]; then
    ENFORCE_REAL_APPID=true
  fi
  if grep -q "wx0000000000000000" "$MANIFEST_FILE" 2>/dev/null; then
    if [ "$ENFORCE_REAL_APPID" = "true" ]; then
      warn "manifest.json 保留公开仓库占位 AppID；真实 AppID 由服务器/微信平台外部配置注入，不在仓库明文复核"
    else
      warn "manifest.json 仍使用占位 AppID wx0000000000000000；体验版/正式版构建需由外部生产配置注入真实 AppID"
    fi
  else
    pass "manifest.json AppID 已配置（非占位值）"
  fi
  if [ -n "${VITE_WX_APPID:-}" ]; then
    if [ "$VITE_WX_APPID" = "wx0000000000000000" ] || ! printf '%s' "$VITE_WX_APPID" | grep -Eq "$WX_APPID_PATTERN"; then
      fail "VITE_WX_APPID 格式非法或仍为占位值，必须为 wx + 16 位字母数字"
    else
      pass "VITE_WX_APPID 格式检查通过"
    fi
  elif [ "$ENFORCE_REAL_APPID" = "true" ]; then
    warn "未提供 VITE_WX_APPID；公开仓库不复核真实 AppID 明文值，体验版/正式版构建需在服务器私有环境注入并留痕"
  fi
  if grep -q '"urlCheck"[[:space:]]*:[[:space:]]*false' "$MANIFEST_FILE" 2>/dev/null; then
    if [ "$ENFORCE_REAL_APPID" = "true" ]; then
      if grep -q "setting.urlCheck = !isProduction ? false : true" apps/miniprogram/scripts/patch-miniprogram-manifest.mjs 2>/dev/null; then
        pass "开发 manifest 可为 urlCheck=false，生产构建脚本会强制改为 true"
      else
        fail "manifest.json 包含 urlCheck=false，且生产构建脚本未强制开启"
      fi
    else
      warn "manifest.json 当前 urlCheck=false（默认门禁允许开发占位，生产门禁将失败）"
    fi
  else
    pass "manifest.json 未配置 urlCheck=false"
  fi
else
  warn "manifest.json 不存在，跳过 AppID 检查"
fi

section "8.65. 小程序生产 API 地址检查"
if [ -z "${VITE_API_BASE_URL:-}" ]; then
  if [ "$STRICT_PROD_GATE" = "true" ] || [ "${NODE_ENV:-}" = "production" ]; then
    warn "未提供 VITE_API_BASE_URL；公开仓库不复核生产 API 明文值，生产 HTTPS 可访问性需在服务器与微信后台验收留痕"
  else
    warn "未提供 VITE_API_BASE_URL"
  fi
elif [[ ! "$VITE_API_BASE_URL" =~ ^https:// ]]; then
  fail "生产环境 VITE_API_BASE_URL 必须以 https:// 开头，当前值: $VITE_API_BASE_URL"
elif [[ ! "${VITE_API_BASE_URL%/}" =~ /api$ ]]; then
  fail "生产环境 VITE_API_BASE_URL 必须以 /api 结尾，当前值: $VITE_API_BASE_URL"
else
  pass "VITE_API_BASE_URL 格式正确 (https://... /api)"
fi

section "8.65b. 上传大小限制检查"
if [ -n "${UPLOAD_MAX_SIZE:-}" ]; then
  if ! [[ "${UPLOAD_MAX_SIZE}" =~ ^[1-9][0-9]*$ ]]; then
    fail "UPLOAD_MAX_SIZE 必须为正整数，当前值: ${UPLOAD_MAX_SIZE}"
  elif [ "${UPLOAD_MAX_SIZE}" -lt 1048576 ]; then
    warn "UPLOAD_MAX_SIZE 小于 1MB (${UPLOAD_MAX_SIZE} bytes)，请确认是否合理"
    pass "UPLOAD_MAX_SIZE 格式合法"
  elif [ "${UPLOAD_MAX_SIZE}" -gt 104857600 ]; then
    warn "UPLOAD_MAX_SIZE 超过 100MB (${UPLOAD_MAX_SIZE} bytes)，请确认是否合理"
    pass "UPLOAD_MAX_SIZE 格式合法"
  else
    pass "UPLOAD_MAX_SIZE 在合理范围内 (${UPLOAD_MAX_SIZE} bytes)"
  fi
else
  pass "UPLOAD_MAX_SIZE 未设置，使用默认 10MB"
fi

parse_nginx_size_bytes() {
  local raw
  raw="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d ';')"
  if [[ "$raw" =~ ^([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ "$raw" =~ ^([0-9]+)k$ ]]; then
    echo $((BASH_REMATCH[1] * 1024))
  elif [[ "$raw" =~ ^([0-9]+)m$ ]]; then
    echo $((BASH_REMATCH[1] * 1024 * 1024))
  elif [[ "$raw" =~ ^([0-9]+)g$ ]]; then
    echo $((BASH_REMATCH[1] * 1024 * 1024 * 1024))
  else
    echo ""
  fi
}

UPLOAD_MAX_SIZE_BYTES="${UPLOAD_MAX_SIZE:-10485760}"
if [[ "$UPLOAD_MAX_SIZE_BYTES" =~ ^[1-9][0-9]*$ ]]; then
  NGINX_UPLOAD_FILES=("deploy/nginx/nginx.conf" "deploy/nginx/conf.d/default.conf")
  for nginx_file in "${NGINX_UPLOAD_FILES[@]}"; do
    if [ ! -f "$nginx_file" ]; then
      fail "$nginx_file 不存在，无法校验 client_max_body_size"
      continue
    fi
    nginx_values=$(grep -E "^[[:space:]]*client_max_body_size[[:space:]]+" "$nginx_file" | awk '{print $2}' || true)
    if [ -z "$nginx_values" ]; then
      fail "$nginx_file 未配置 client_max_body_size，无法确认上传网关上限"
      continue
    fi
    while read -r nginx_size; do
      [ -z "$nginx_size" ] && continue
      nginx_bytes="$(parse_nginx_size_bytes "$nginx_size")"
      if [ -z "$nginx_bytes" ]; then
        fail "$nginx_file client_max_body_size 格式无法解析: $nginx_size"
      elif [ "$nginx_bytes" -lt "$UPLOAD_MAX_SIZE_BYTES" ]; then
        fail "$nginx_file client_max_body_size($nginx_size) 小于 UPLOAD_MAX_SIZE(${UPLOAD_MAX_SIZE_BYTES} bytes)"
      else
        pass "$nginx_file client_max_body_size($nginx_size) >= UPLOAD_MAX_SIZE(${UPLOAD_MAX_SIZE_BYTES} bytes)"
      fi
    done <<< "$nginx_values"
  done
else
  warn "UPLOAD_MAX_SIZE 非法，跳过 Nginx client_max_body_size 关系检查"
fi

section "8.66. 小程序生产演示口径检查"
DEMO_HITS=$(grep -RInE "演示版|公开演示内容|demo=1|allowDemo|VITE_ENABLE_DEMO_MODE[[:space:]]*=[[:space:]]*true" apps/miniprogram/src apps/miniprogram/.env.example apps/miniprogram/.env.production.example 2>/dev/null || true)
if [ -n "$DEMO_HITS" ]; then
  if [ "$STRICT_PROD_GATE" = "true" ] || [ "${NODE_ENV:-}" = "production" ]; then
    fail "小程序源码或环境示例包含生产禁止的 demo/演示口径"
    echo "$DEMO_HITS" | head -20 | sed 's/^/    /'
  else
    warn "发现小程序 demo/演示口径，生产门禁将失败"
    echo "$DEMO_HITS" | head -10 | sed 's/^/    /'
  fi
else
  pass "小程序源码未发现生产禁止的 demo/演示口径"
fi

section "8.67. 管理后台静态资源刷新机制检查"
DOCKERFILE_API_PATH="deploy/Dockerfile.api"
ENTRYPOINT_PATH="deploy/scripts/entrypoint.sh"
COMPOSE_PATH="deploy/docker-compose.yml"

if grep -q 'COPY --from=admin-builder.*\/app\/admin-dist' "$DOCKERFILE_API_PATH"; then
  pass "Dockerfile.api: admin dist 复制到 /app/admin-dist"
else
  fail "Dockerfile.api: 未找到 COPY --from=admin-builder 到 /app/admin-dist 的行"
fi

if grep -q 'cp -a /app/admin-dist' "$ENTRYPOINT_PATH"; then
  pass "entrypoint.sh: 包含 admin dist 同步逻辑"
else
  fail "entrypoint.sh: 未找到 admin dist 同步逻辑（cp -a /app/admin-dist）"
fi

if grep -q 'admin_dist:/usr/share/nginx/admin' "$COMPOSE_PATH"; then
  pass "docker-compose.yml: api 服务挂载 admin_dist volume"
else
  fail "docker-compose.yml: api 服务未挂载 admin_dist volume"
fi

section "8.7. 协议页面正式化检查"
AGREEMENT_FILES=(
  "apps/miniprogram/src/pages/privacy/index.vue"
  "apps/miniprogram/src/pages/agreement/index.vue"
  "apps/miniprogram/src/pages/food-safety/index.vue"
)
TODO_PATTERNS=("TODO" "暂定" "2026年__月__日" "__月__日")
for file in "${AGREEMENT_FILES[@]}"; do
  if [ -f "$file" ]; then
    for pattern in "${TODO_PATTERNS[@]}"; do
      if grep -q "$pattern" "$file" 2>/dev/null; then
        fail "协议页面 $file 包含未确认内容: '$pattern'（需运营/法务确认后移除）"
      fi
    done
    pass "协议页面 $file 已检查"
  else
    warn "协议页面 $file 不存在"
  fi
done

section "8.75. 协议联系方式配置门禁检查"
LEGAL_CONFIG_FILE="apps/miniprogram/src/config/legal.ts"
LEGAL_PLACEHOLDERS=(
  "以「客服与帮助」页面电话为准"
  "以「客服与帮助」页面微信客服信息为准"
  "以售后审核结果中的退货地址为准"
)
if [ -f "$LEGAL_CONFIG_FILE" ]; then
  for pattern in "${LEGAL_PLACEHOLDERS[@]}"; do
    if grep -q "$pattern" "$LEGAL_CONFIG_FILE" 2>/dev/null; then
      warn "legal.ts 保留公开占位联系方式：$pattern；不作为公开仓库 No-Go，体验版/线上客服入口必须真实可用并验收留痕"
    fi
  done
  pass "legal.ts 联系方式公开仓库检查已执行"
else
  warn "legal.ts 不存在，跳过联系方式门禁检查"
fi

section "8.8. GO_LIVE 结论一致性检查"
GO_LIVE_FILE="GO_LIVE.md"
if [ -f "$GO_LIVE_FILE" ]; then
  if grep -q "可正式上线" "$GO_LIVE_FILE" 2>/dev/null; then
    fail "GO_LIVE.md 包含“可正式上线”表述，请以真实 release-check 结果更新结论"
  else
    pass "GO_LIVE.md 未出现“可正式上线”误导性结论"
  fi
else
  warn "GO_LIVE.md 不存在，跳过结论一致性检查"
fi

section "9. 部署脚本可执行权限检查"
SCRIPT_DIR="deploy/scripts"
if [ -d "$SCRIPT_DIR" ]; then
  for script in "$SCRIPT_DIR"/*.sh; do
    if [ -f "$script" ]; then
      basename_script=$(basename "$script")
      if [ -x "$script" ]; then
        pass "$basename_script 有可执行权限"
      else
        warn "$basename_script 缺少可执行权限，请执行: chmod +x $script"
      fi
    fi
  done
else
  warn "部署脚本目录 $SCRIPT_DIR 不存在"
fi

section "10. Docker 环境检查 (手动确认)"
if command -v docker &> /dev/null; then
  if docker info > /dev/null 2>&1; then
    pass "Docker 可用"
  else
    warn "Docker 已安装但未运行，Docker 相关检查需手动确认"
  fi
else
  skip "Docker 未安装，Docker 相关检查需手动确认"
fi

section "11. Git 状态检查"
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  pass "工作目录干净（无未提交更改）"
else
  warn "工作目录有未提交更改，发版前请确认是否需要提交"
  git status --short 2>/dev/null | head -10 | while read line; do
    echo -e "    $line"
  done
fi

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  pass "当前分支: $CURRENT_BRANCH"
else
  warn "当前分支: $CURRENT_BRANCH（发版通常从 main/master 分支进行）"
fi

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}WARN: $WARN${NC}  ${CYAN}SKIP: $SKIP${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -gt 0 ]; then
  CODE_FREEZE_RESULT="FAIL"
else
  CODE_FREEZE_RESULT="PASS"
fi

if [ "$FAIL" -gt 0 ]; then
  PRODUCTION_GATE_RESULT="FAIL"
else
  PRODUCTION_GATE_RESULT="WARN"
fi

echo -e "Code Freeze Gate: ${CODE_FREEZE_RESULT}"
echo -e "Production Release Gate: ${PRODUCTION_GATE_RESULT}"
echo -e "Production Runtime Acceptance: PENDING_SERVER_GATE_AND_REAL_DEVICE_EVIDENCE"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}✗ Release Gate 未通过！请修复上述 FAIL 项后重试。${NC}"
  exit 1
else
  echo -e "\n${GREEN}✓ 代码仓库 Release Gate 通过！可以继续生产运行验收流程。${NC}"
  echo -e "${YELLOW}提示：正式发布仍需完成并留痕以下运行时验收：${NC}"
  echo -e "  1. 服务器私有环境变量已生效"
  echo -e "  2. docker compose up -d --build 与 prisma migrate deploy"
  echo -e "  3. 生产 API HTTPS、Nginx、健康检查与 smoke 测试"
  echo -e "  4. 微信合法域名、体验版上传与真机验收"
  echo -e "  5. 支付/退款回调真实可达、验签通过、状态流转正确"
  exit 0
fi
