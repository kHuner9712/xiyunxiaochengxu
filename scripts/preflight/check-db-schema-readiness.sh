#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 数据库 Schema 就绪检查
# 检查所有关键表、字段、配置项、菜单是否存在
# 用法：bash check-db-schema-readiness.sh --env /path/to/.env
# ============================================================

set -uo pipefail

ENV_FILE=""
REPO_PATH="."

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env=*)   ENV_FILE="${1#*=}"; shift ;;
        --env)     ENV_FILE="${2:-}"; shift 2 ;;
        --repo=*)  REPO_PATH="${1#*=}"; shift ;;
        --repo)    REPO_PATH="${2:-}"; shift 2 ;;
        *)         shift ;;
    esac
done

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"
BLOCKER_COUNT=0
WARN_COUNT=0

blocker() { echo -e "${RED}[BLOCKER]${RESET} $1"; BLOCKER_COUNT=$((BLOCKER_COUNT + 1)); }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
pass()    { echo -e "${GREEN}[PASS]${RESET} $1"; }
section() { echo -e "\n${CYAN}=== $1 ===${RESET}"; }

if [[ -z "$ENV_FILE" ]] || [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}错误：--env 指向 .env 文件不存在${RESET}"
    exit 1
fi

DB_HOST=$(grep -oP 'HOSTNAME\s*=\s*\K.*' "$ENV_FILE" 2>/dev/null | head -1 | xargs)
DB_PORT=$(grep -oP 'HOSTPORT\s*=\s*\K.*' "$ENV_FILE" 2>/dev/null | head -1 | xargs)
DB_NAME=$(grep -oP 'DATABASE\s*=\s*\K.*' "$ENV_FILE" 2>/dev/null | head -1 | xargs)
DB_USER=$(grep -oP 'USERNAME\s*=\s*\K.*' "$ENV_FILE" 2>/dev/null | head -1 | xargs)
DB_PASS=$(grep -oP 'PASSWORD\s*=\s*\K.*' "$ENV_FILE" 2>/dev/null | head -1 | xargs)

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [[ -z "$DB_NAME" ]] || [[ -z "$DB_USER" ]]; then
    echo -e "${RED}错误：.env 中数据库配置不完整${RESET}"
    exit 1
fi

MYSQL="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"
if [[ -n "$DB_PASS" ]]; then
    MYSQL="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS"
fi

$MYSQL -e "SELECT 1;" "$DB_NAME" &>/dev/null || { echo -e "${RED}数据库连接失败${RESET}"; exit 1; }

q() {
    $MYSQL -N -e "$1" "$DB_NAME" 2>/dev/null
}

col_exists() {
    local t="$1"; local c="$2"
    local cnt=$(q "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${t}' AND COLUMN_NAME='${c}';")
    [[ "${cnt:-0}" -gt 0 ]]
}

tbl_exists() {
    local t="$1"
    local cnt=$(q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${t}';")
    [[ "${cnt:-0}" -gt 0 ]]
}

cfg_exists() {
    local tag="$1"
    local cnt=$(q "SELECT COUNT(*) FROM sxo_config WHERE only_tag='${tag}';")
    [[ "${cnt:-0}" -gt 0 ]]
}

cfg_value() {
    q "SELECT value FROM sxo_config WHERE only_tag='${1}' LIMIT 1;" 2>/dev/null
}

section "1. 核心表检查"

for t in sxo_activity sxo_activity_signup sxo_invite_reward sxo_muying_feedback; do
    if tbl_exists "$t"; then pass "表 ${t} 存在"
    else blocker "表 ${t} 不存在，需执行 muying-final-migration.sql"; fi
done

section "2. 隐私安全字段检查"

if col_exists "sxo_activity_signup" "phone_hash"; then pass "sxo_activity_signup.phone_hash 存在"
else blocker "sxo_activity_signup.phone_hash 不存在，需执行 muying-privacy-security-migration.sql"; fi

if col_exists "sxo_activity_signup" "privacy_version"; then pass "sxo_activity_signup.privacy_version 存在"
else blocker "sxo_activity_signup.privacy_version 不存在，需执行 muying-privacy-security-migration.sql"; fi

if tbl_exists "sxo_muying_audit_log"; then pass "sxo_muying_audit_log 存在"
else blocker "sxo_muying_audit_log 不存在，需执行 muying-privacy-security-migration.sql"; fi

section "3. 活动升级字段检查"

if col_exists "sxo_activity" "activity_type"; then pass "sxo_activity.activity_type 存在"
else blocker "sxo_activity.activity_type 不存在，需执行 muying-activity-upgrade-migration.sql"; fi

if col_exists "sxo_activity" "waitlist_count"; then pass "sxo_activity.waitlist_count 存在"
else blocker "sxo_activity.waitlist_count 不存在，需执行 muying-activity-upgrade-migration.sql"; fi

if col_exists "sxo_activity_signup" "is_waitlist"; then pass "sxo_activity_signup.is_waitlist 存在"
else blocker "sxo_activity_signup.is_waitlist 不存在，需执行 muying-activity-upgrade-migration.sql"; fi

if col_exists "sxo_activity_signup" "signup_code"; then pass "sxo_activity_signup.signup_code 存在"
else blocker "sxo_activity_signup.signup_code 不存在，需执行 muying-activity-upgrade-migration.sql"; fi

section "4. 商品合规字段检查"

if col_exists "sxo_goods" "risk_category"; then pass "sxo_goods.risk_category 存在"
else blocker "sxo_goods.risk_category 不存在，需执行 muying-goods-compliance-migration.sql"; fi

if col_exists "sxo_goods" "qualification_status"; then pass "sxo_goods.qualification_status 存在"
else blocker "sxo_goods.qualification_status 不存在，需执行 muying-goods-compliance-migration.sql"; fi

section "5. 合规日志表检查"

if tbl_exists "sxo_muying_compliance_log"; then pass "sxo_muying_compliance_log 存在"
else blocker "sxo_muying_compliance_log 不存在，需执行 muying-compliance-center-migration.sql"; fi

section "6. 功能开关配置检查"

for key in feature_activity_enabled feature_invite_enabled feature_content_enabled feature_feedback_enabled feature_coupon_enabled feature_signin_enabled feature_points_enabled; do
    if cfg_exists "$key"; then pass "配置 ${key} 存在"
    else blocker "配置 ${key} 不存在，需执行 muying-feature-switch-migration.sql"; fi
done

section "7. 资质门禁配置检查"

for key in qualification_icp_commercial qualification_edi qualification_medical qualification_live qualification_payment qualification_icp_filing; do
    if cfg_exists "$key"; then pass "配置 ${key} 存在"
    else blocker "配置 ${key} 不存在，需执行 muying-feature-switch-migration.sql 或 muying-compliance-center-migration.sql"; fi
done

section "8. 菜单权限检查"

POWER_DASHBOARD=$(q "SELECT COUNT(*) FROM sxo_power WHERE name='禧孕数据看板';")
if [[ "${POWER_DASHBOARD:-0}" -gt 0 ]]; then pass "禧孕数据看板菜单存在"
else blocker "禧孕数据看板菜单不存在，需执行 muying-admin-power-migration.sql"; fi

POWER_COMPLIANCE=$(q "SELECT COUNT(*) FROM sxo_power WHERE name='合规中心';")
if [[ "${POWER_COMPLIANCE:-0}" -gt 0 ]]; then pass "合规中心菜单存在"
else blocker "合规中心菜单不存在，需执行 muying-compliance-center-migration.sql"; fi

section "9. 菜单 ID 冲突检查"

CONTROL_760=$(q "SELECT control FROM sxo_power WHERE id=760 LIMIT 1;" 2>/dev/null)
if [[ "$CONTROL_760" == "Muyingcompliance" ]]; then
    blocker "id=760 被合规中心占用（应为数据看板），需执行修复 SQL"
elif [[ "$CONTROL_760" == "Muyingstat" ]]; then
    pass "id=760 为禧孕数据看板，正确"
else
    warn "id=760 不存在或 control 值异常: ${CONTROL_760}"
fi

CONTROL_770=$(q "SELECT control FROM sxo_power WHERE id=770 LIMIT 1;" 2>/dev/null)
if [[ "$CONTROL_770" == "Muyingcompliance" ]]; then
    pass "id=770 为合规中心，正确"
elif [[ -z "$CONTROL_770" ]]; then
    warn "id=770 不存在，需执行 muying-compliance-center-migration.sql"
else
    blocker "id=770 被其他菜单占用: ${CONTROL_770}"
fi

section "10. 高风险功能开关状态检查"

for key in feature_shop_enabled feature_realstore_enabled feature_distribution_enabled feature_wallet_enabled feature_coin_enabled feature_ugc_enabled feature_hospital_enabled feature_live_enabled feature_membership_enabled feature_giftcard_enabled; do
    val=$(cfg_value "$key")
    if [[ "$val" == "1" ]]; then
        warn "${key} = 1（已开启），一期应保持关闭"
    elif [[ "$val" == "0" ]]; then
        pass "${key} = 0（已关闭）"
    else
        pass "${key} 未配置（默认关闭）"
    fi
done

section "11. 资质门禁状态检查"

QUAL_MODE=$(grep -oP 'MUYING_QUALIFICATION_MODE\s*=\s*\K.*' "$ENV_FILE" 2>/dev/null | head -1 | xargs)
if [[ "$QUAL_MODE" == "phase_two" ]] || [[ "$QUAL_MODE" == "strict" ]]; then
    warn "MUYING_QUALIFICATION_MODE=${QUAL_MODE}，一期应使用 phase_one"
else
    pass "资质门禁模式正确（phase_one/loose）"
fi

echo ""
echo "=========================================="
echo " 检查结果：${BLOCKER_COUNT} BLOCKER / ${WARN_COUNT} WARN"
echo "=========================================="

if [[ $BLOCKER_COUNT -gt 0 ]]; then
    exit 1
fi
exit 0
