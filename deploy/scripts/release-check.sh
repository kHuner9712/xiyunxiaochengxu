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

IS_WINDOWS=false
if [ -n "${WINDIR:-}" ] || [ -n "${MSYSTEM:-}" ] || uname -r 2>/dev/null | grep -qi microsoft; then
  IS_WINDOWS=true
fi

if [ "$IS_WINDOWS" = true ]; then
  run_pnpm() {
    cmd.exe /c "pnpm $*" > "$TMPFILE" 2>&1
  }
else
  run_pnpm() {
    pnpm "$@" > "$TMPFILE" 2>&1
  }
fi

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

section "1. Prisma Schema 验证"
if run_pnpm --filter @baby-mall/api prisma:validate; then
  pass "prisma:validate 通过"
else
  fail "prisma:validate 失败，请检查 schema.prisma"
  tail -5 "$TMPFILE" | sed 's/^/    /'
fi

section "2. API 测试 (unit + e2e)"
if run_pnpm --filter @baby-mall/api test:ci; then
  pass "test:ci 通过"
else
  fail "test:ci 失败，请检查测试输出"
  tail -10 "$TMPFILE" | sed 's/^/    /'
fi

section "3. API 构建"
if run_pnpm build:api; then
  pass "build:api 通过"
else
  fail "build:api 失败"
  tail -5 "$TMPFILE" | sed 's/^/    /'
fi

section "4. Admin Web 构建"
if run_pnpm build:admin; then
  pass "build:admin 通过"
else
  fail "build:admin 失败"
  tail -5 "$TMPFILE" | sed 's/^/    /'
fi

section "4.5 小程序构建"
if run_pnpm build:mini; then
  pass "build:mini 通过"
else
  fail "build:mini 失败，商用上线前小程序构建必须通过"
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
  check_field_in_schema "OrderRefund" "outRefundNo" "OrderRefund.outRefundNo 字段"
  check_field_in_schema "OrderRefund" "initiating" "OrderRefund.status 包含 initiating 默认值"
  check_field_in_schema "RefundCallbackLog" "orphan" "RefundCallbackLog.status 包含 orphan"
  check_enum_in_schema "AftersaleStatus" "pending_refund" "AftersaleStatus 包含 pending_refund"
else
  fail "schema.prisma 不存在: $SCHEMA_FILE"
fi

section "8. .env.example 必要变量检查"
ENV_EXAMPLE=".env.example"
REQUIRED_VARS=("DATABASE_URL" "REDIS_HOST" "JWT_SECRET" "CORS_ORIGINS" "WECHAT_NOTIFY_URL" "WECHAT_REFUND_NOTIFY_URL" "ALERT_WEBHOOK_URL")

if [ -f "$ENV_EXAMPLE" ]; then
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "$var" "$ENV_EXAMPLE" 2>/dev/null; then
      pass ".env.example 包含 $var"
    else
      warn ".env.example 缺少 $var（可能需要添加）"
    fi
  done
else
  fail ".env.example 不存在"
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
  echo -e "\n${RED}✗ Release Gate 未通过！请修复上述 FAIL 项后重试。${NC}"
  exit 1
else
  echo -e "\n${GREEN}✓ Release Gate 通过！可以继续发版流程。${NC}"
  echo -e "${YELLOW}提示：请确保已手动完成以下步骤：${NC}"
  echo -e "  1. 数据库备份"
  echo -e "  2. docker compose up -d --build"
  echo -e "  3. prisma migrate deploy"
  echo -e "  4. 冒烟测试 (pnpm smoke)"
  echo -e "  5. 支付/退款回调验证"
  exit 0
fi
