#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — 数据库迁移执行脚本
# ============================================================
#
# 【用途】按正确顺序执行所有 muying 迁移 SQL
# 【用法】bash run-migrations.sh [选项]
# 【选项】
#   --site-dir PATH   站点目录（必填）
#   --db-host HOST    数据库主机（默认 127.0.0.1）
#   --db-port PORT    数据库端口（默认 3306）
#   --db-name NAME    数据库名（必填）
#   --db-user USER    数据库用户（必填）
#   --db-pass PASS    数据库密码（必填）
#   --skip-main       跳过 shopxo.sql 主库导入
#   --help            显示帮助
#
# 【迁移策略】
#   - shopxo.sql 和 muying-final-migration.sql 不可重复执行，脚本会检查表是否存在
#   - 其余 9 个迁移均为幂等迁移，脚本直接执行，不跳过
#   - 执行完毕后统一验证关键字段/表/配置/菜单
#
# 【迁移顺序】（不可调换）
#   1.  shopxo.sql                                — 主库（不可重复执行）
#   2.  muying-final-migration.sql                — 孕禧核心表（不可重复）
#   3.  sql/muying-feature-switch-migration.sql   — 功能开关完整初始化（幂等）
#   4.  muying-feedback-review-migration.sql      — 反馈审核字段（幂等）
#   5.  muying-invite-reward-unify-migration.sql  — 邀请奖励统一（幂等）
#   6.  sql/muying-privacy-security-migration.sql — 隐私安全字段+审计日志表（幂等）
#   7.  sql/muying-goods-compliance-migration.sql — 商品合规字段（幂等）
#   8.  muying-activity-upgrade-migration.sql     — 活动升级字段（幂等）
#   9.  muying-feature-flag-upgrade-migration.sql — 功能开关升级补丁（幂等）
#   10. muying-admin-power-migration.sql          — 后台菜单权限（幂等）
#   11. sql/muying-compliance-center-migration.sql — 合规中心菜单+日志（幂等）
#
# 【退出码】0=成功，1=失败
# ============================================================

set -uo pipefail

SITE_DIR=""
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME=""
DB_USER=""
DB_PASS=""
SKIP_MAIN=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --site-dir=*) SITE_DIR="${1#*=}"; shift ;;
        --site-dir)   SITE_DIR="${2:-}"; shift 2 ;;
        --db-host=*)  DB_HOST="${1#*=}"; shift ;;
        --db-port=*)  DB_PORT="${1#*=}"; shift ;;
        --db-name=*)  DB_NAME="${1#*=}"; shift ;;
        --db-user=*)  DB_USER="${1#*=}"; shift ;;
        --db-pass=*)  DB_PASS="${1#*=}"; shift ;;
        --skip-main)  SKIP_MAIN=1; shift ;;
        --help|-h)    head -40 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *)            shift ;;
    esac
done

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"
step() { echo -e "\n${CYAN}[STEP]${RESET} $1"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $1"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; exit 1; }

if [[ -z "$SITE_DIR" ]]; then fail "--site-dir 必填"; fi
if [[ -z "$DB_NAME" ]]; then fail "--db-name 必填"; fi
if [[ -z "$DB_USER" ]]; then fail "--db-user 必填"; fi

MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"
if [[ -n "$DB_PASS" ]]; then
    MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS"
fi

if ! command -v mysql &>/dev/null; then
    fail "mysql 客户端未安装"
fi

$MYSQL_CMD -e "SELECT 1;" "$DB_NAME" &>/dev/null || fail "数据库连接失败"

find_sql() {
    local name="$1"
    for dir in "$SITE_DIR" "$SITE_DIR/.." "$(cd "$SITE_DIR" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)"; do
        if [[ -f "${dir}/docs/${name}" ]]; then
            echo "${dir}/docs/${name}"
            return
        fi
    done
    echo ""
}

table_exists() {
    local table="$1"
    local count=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${table}';" "$DB_NAME" 2>/dev/null || echo "0")
    [[ "${count:-0}" -gt 0 ]]
}

column_exists() {
    local table="$1"
    local column="$2"
    local count=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${table}' AND COLUMN_NAME='${column}';" "$DB_NAME" 2>/dev/null || echo "0")
    [[ "${count:-0}" -gt 0 ]]
}

config_exists() {
    local tag="$1"
    local count=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM sxo_config WHERE only_tag='${tag}';" "$DB_NAME" 2>/dev/null || echo "0")
    [[ "${count:-0}" -gt 0 ]]
}

run_idempotent() {
    local desc="$1"
    local sql_file="$2"

    if [[ ! -f "$sql_file" ]]; then
        warn "未找到 ${desc}（${sql_file}），跳过"
        return
    fi

    $MYSQL_CMD "$DB_NAME" < "$sql_file" || fail "${desc} 执行失败"
    ok "${desc} 执行成功"
}

echo ""
echo "=========================================="
echo " 数据库迁移执行 (11 步完整链路)"
echo " 策略：不可重复迁移检查后执行，幂等迁移直接执行"
echo "=========================================="

# --- 1. shopxo.sql 主库（不可重复） ---
if [[ $SKIP_MAIN -eq 0 ]]; then
    step "1/11 shopxo.sql — 主库初始化（不可重复）"
    MAIN_SQL="${SITE_DIR}/config/shopxo.sql"
    if [[ -f "$MAIN_SQL" ]]; then
        if table_exists "sxo_user"; then
            warn "sxo_user 表已存在，跳过主库导入"
        else
            $MYSQL_CMD "$DB_NAME" < "$MAIN_SQL" || fail "shopxo.sql 导入失败"
            ok "shopxo.sql 导入成功"
        fi
    else
        fail "找不到 config/shopxo.sql"
    fi
else
    step "1/11 shopxo.sql — 已跳过（--skip-main）"
fi

# --- 2. muying-final-migration.sql（不可重复） ---
step "2/11 muying-final-migration.sql — 孕禧核心表（不可重复）"
SQL_FILE=$(find_sql "muying-final-migration.sql")
if [[ -n "$SQL_FILE" ]]; then
    if table_exists "sxo_activity"; then
        warn "sxo_activity 表已存在，跳过核心表创建"
    else
        $MYSQL_CMD "$DB_NAME" < "$SQL_FILE" || fail "muying-final-migration.sql 执行失败"
        ok "孕禧核心表创建成功"
    fi
else
    warn "未找到 muying-final-migration.sql，跳过"
fi

# --- 3-11：幂等迁移，直接执行 ---

step "3/11 muying-feature-switch-migration.sql — 功能开关完整初始化（幂等）"
SQL_FILE=$(find_sql "sql/muying-feature-switch-migration.sql")
run_idempotent "功能开关完整初始化" "$SQL_FILE"

step "4/11 muying-feedback-review-migration.sql — 反馈审核字段（幂等）"
SQL_FILE=$(find_sql "muying-feedback-review-migration.sql")
run_idempotent "反馈审核字段" "$SQL_FILE"

step "5/11 muying-invite-reward-unify-migration.sql — 邀请奖励统一（幂等）"
SQL_FILE=$(find_sql "muying-invite-reward-unify-migration.sql")
run_idempotent "邀请奖励统一" "$SQL_FILE"

step "6/11 muying-privacy-security-migration.sql — 隐私安全+审计日志（幂等）"
SQL_FILE=$(find_sql "sql/muying-privacy-security-migration.sql")
run_idempotent "隐私安全字段" "$SQL_FILE"

step "7/11 muying-goods-compliance-migration.sql — 商品合规字段（幂等）"
SQL_FILE=$(find_sql "sql/muying-goods-compliance-migration.sql")
run_idempotent "商品合规字段" "$SQL_FILE"

step "8/11 muying-activity-upgrade-migration.sql — 活动升级（幂等）"
SQL_FILE=$(find_sql "muying-activity-upgrade-migration.sql")
run_idempotent "活动升级字段" "$SQL_FILE"

step "9/11 muying-feature-flag-upgrade-migration.sql — 功能开关升级补丁（幂等）"
SQL_FILE=$(find_sql "muying-feature-flag-upgrade-migration.sql")
run_idempotent "功能开关升级补丁" "$SQL_FILE"

step "10/11 muying-admin-power-migration.sql — 后台菜单权限（幂等）"
SQL_FILE=$(find_sql "muying-admin-power-migration.sql")
run_idempotent "后台菜单权限" "$SQL_FILE"

step "11/11 muying-compliance-center-migration.sql — 合规中心菜单+日志（幂等）"
SQL_FILE=$(find_sql "sql/muying-compliance-center-migration.sql")
run_idempotent "合规中心" "$SQL_FILE"

echo ""
echo "=========================================="
echo " 数据库迁移执行完成，开始验证"
echo "=========================================="

ERRORS=0

check_column() {
    local table="$1"
    local column="$2"
    if column_exists "$table" "$column"; then
        ok "验证通过: ${table}.${column}"
    else
        fail "验证失败: ${table}.${column} 不存在"
        ERRORS=$((ERRORS + 1))
    fi
}

check_table() {
    local table="$1"
    if table_exists "$table"; then
        ok "验证通过: ${table}"
    else
        fail "验证失败: ${table} 不存在"
        ERRORS=$((ERRORS + 1))
    fi
}

check_config() {
    local tag="$1"
    if config_exists "$tag"; then
        ok "验证通过: config ${tag}"
    else
        fail "验证失败: config ${tag} 不存在"
        ERRORS=$((ERRORS + 1))
    fi
}

check_power() {
    local name="$1"
    local count=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM sxo_power WHERE name='${name}';" "$DB_NAME" 2>/dev/null || echo "0")
    if [[ "${count:-0}" -gt 0 ]]; then
        ok "验证通过: 菜单 ${name}"
    else
        fail "验证失败: 菜单 ${name} 不存在"
        ERRORS=$((ERRORS + 1))
    fi
}

echo ""
echo "--- 字段验证 ---"
check_column "sxo_activity" "activity_type"
check_column "sxo_activity" "waitlist_count"
check_column "sxo_activity_signup" "phone_hash"
check_column "sxo_activity_signup" "privacy_version"
check_column "sxo_activity_signup" "is_waitlist"
check_column "sxo_activity_signup" "signup_code"
check_column "sxo_goods" "risk_category"
check_column "sxo_goods" "qualification_status"

echo ""
echo "--- 表验证 ---"
check_table "sxo_muying_audit_log"
check_table "sxo_muying_compliance_log"

echo ""
echo "--- 配置项验证 ---"
check_config "feature_activity_enabled"
check_config "qualification_icp_commercial"
check_config "qualification_icp_filing"

echo ""
echo "--- 菜单验证 ---"
check_power "孕禧数据看板"
check_power "合规中心"

echo ""
if [[ $ERRORS -eq 0 ]]; then
    ok "全部验证通过，迁移完成"
else
    fail "有 ${ERRORS} 项验证失败，请检查"
    exit 1
fi

echo ""
echo "  已执行的迁移（11 步完整链路）:"
echo "    1.  shopxo.sql — 主库（不可重复）"
echo "    2.  muying-final-migration.sql — 核心表（不可重复）"
echo "    3.  muying-feature-switch-migration.sql — 功能开关完整初始化（幂等）"
echo "    4.  muying-feedback-review-migration.sql — 反馈审核（幂等）"
echo "    5.  muying-invite-reward-unify-migration.sql — 邀请统一（幂等）"
echo "    6.  muying-privacy-security-migration.sql — 隐私安全（幂等）"
echo "    7.  muying-goods-compliance-migration.sql — 商品合规（幂等）"
echo "    8.  muying-activity-upgrade-migration.sql — 活动升级（幂等）"
echo "    9.  muying-feature-flag-upgrade-migration.sql — 功能开关升级补丁（幂等）"
echo "    10. muying-admin-power-migration.sql — 菜单权限（幂等）"
echo "    11. muying-compliance-center-migration.sql — 合规中心（幂等）"
echo ""
ok "全部迁移完成"
exit 0
