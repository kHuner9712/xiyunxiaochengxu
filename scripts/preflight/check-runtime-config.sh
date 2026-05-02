#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 运行时配置完整性检查
# ============================================================
#
# 【用途】检查后端关键配置项是否已填写（客服电话、隐私弹窗文案、
#        功能开关、首单奖励积分等），需在服务器上执行
# 【用法】bash check-runtime-config.sh [选项] --env /path/to/.env
# 【选项】
#   --env FILE      后端 .env 文件路径（必填）
#   --api URL       后端 API 基础 URL（可选，用于 API 检查）
#   --no-color      关闭彩色输出
#   --help          显示帮助
#
# 【输出等级】PASS / WARN / BLOCKER
# 【退出码】0=无 BLOCKER，1=存在 BLOCKER
# ============================================================

set -uo pipefail

ENV_FILE=""
API_URL=""
NO_COLOR=0

for arg in "$@"; do
    case "$arg" in
        --env=*)     ENV_FILE="${arg#*=}"; shift ;;
        --env)       ENV_FILE="${2:-}"; shift 2 ;;
        --api=*)     API_URL="${arg#*=}"; shift ;;
        --api)       API_URL="${2:-}"; shift 2 ;;
        --no-color)  NO_COLOR=1; shift ;;
        --help|-h)   head -22 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *)           shift ;;
    esac
done

if [[ $NO_COLOR -eq 1 ]] || [[ ! -t 1 ]]; then
    C_PASS=""; C_WARN=""; C_BLOCK=""; C_INFO=""; C_RESET=""
else
    C_PASS="\033[32m"; C_WARN="\033[33m"; C_BLOCK="\033[31m"
    C_INFO="\033[36m"; C_RESET="\033[0m"
fi

PASS_COUNT=0
WARN_COUNT=0
BLOCK_COUNT=0

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "${C_PASS}[PASS]${C_RESET} $1"; }
warn() { WARN_COUNT=$((WARN_COUNT + 1)); echo -e "${C_WARN}[WARN]${C_RESET} $1"; }
blocker() { BLOCK_COUNT=$((BLOCK_COUNT + 1)); echo -e "${C_BLOCK}[BLOCKER]${C_RESET} $1"; }
info() { echo -e "${C_INFO}[INFO]${C_RESET} $1"; }

section() {
    echo ""
    echo "=========================================="
    echo " $1"
    echo "=========================================="
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-shopxo}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_PREFIX="${DB_PREFIX:-sxo_}"

if [[ -n "$ENV_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    LIB_ENV="${SCRIPT_DIR}/lib-env.sh"
    if [[ -f "$LIB_ENV" ]]; then
        source "$LIB_ENV"
        parse_env_file "$ENV_FILE"
    fi
fi

mysql_query() {
    local sql="$1"
    if [[ -n "$DB_PASS" ]]; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -N -e "$sql" "$DB_NAME" 2>/dev/null || echo ""
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e "$sql" "$DB_NAME" 2>/dev/null || echo ""
    fi
}

section "运行时配置完整性检查"

# ============================================================
# 1. 数据库连接
# ============================================================
section "1. 数据库连接"

DB_OK=0
if command -v mysql &>/dev/null; then
    if [[ -n "$DB_PASS" ]]; then
        if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
            pass "数据库连接成功"
            DB_OK=1
        else
            blocker "数据库连接失败（检查 .env 中数据库配置）"
        fi
    else
        if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
            pass "数据库连接成功"
            DB_OK=1
        else
            blocker "数据库连接失败"
        fi
    fi
else
    blocker "mysql CLI 不可用，无法检查运行时配置"
fi

if [[ $DB_OK -eq 0 ]]; then
    section "检查汇总"
    echo -e "${C_BLOCK}数据库不可用，无法继续检查${C_RESET}"
    exit 1
fi

# ============================================================
# 2. 必需表检查
# ============================================================
section "2. 必需数据表"

REQUIRED_TABLES="activity activity_signup invite_reward muying_feedback config"
for table in $REQUIRED_TABLES; do
    FULL_TABLE="${DB_PREFIX}${table}"
    EXISTS=$(mysql_query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${FULL_TABLE}';")
    EXISTS=${EXISTS:-0}
    if [[ "$EXISTS" -gt 0 ]]; then
        pass "表存在: ${FULL_TABLE}"
    else
        blocker "表缺失: ${FULL_TABLE}（需执行迁移 SQL）"
    fi
done

# ============================================================
# 3. 功能开关配置
# ============================================================
section "3. 功能开关配置"

FEATURE_FLAGS="feature_activity_enabled feature_invite_enabled feature_content_enabled feature_feedback_enabled"
for flag in $FEATURE_FLAGS; do
    VAL=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='${flag}';")
    if [[ -n "$VAL" ]]; then
        pass "功能开关: ${flag} = ${VAL}"
    else
        warn "功能开关未配置: ${flag}（将使用前端默认值）"
    fi
done

# ============================================================
# 4. 邀请配置
# ============================================================
section "4. 邀请配置"

INVITE_CONFIGS="muying_invite_first_order_reward muying_invite_auto_grant muying_invite_daily_limit muying_invite_slogan"
for tag in $INVITE_CONFIGS; do
    VAL=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='${tag}';")
    if [[ -n "$VAL" ]]; then
        pass "邀请配置: ${tag} = ${VAL}"
    else
        if [[ "$tag" == "muying_invite_first_order_reward" ]]; then
            blocker "邀请配置缺失: ${tag}（首单奖励积分为必填项）"
        else
            warn "邀请配置缺失: ${tag}（将使用默认值）"
        fi
    fi
done

# ============================================================
# 5. 客服电话
# ============================================================
section "5. 客服与联系方式"

CS_TEL=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='common_app_customer_service_tel';")
if [[ -n "$CS_TEL" && "$CS_TEL" != "400-000-0000" ]]; then
    pass "客服电话: ${CS_TEL}"
else
    warn "客服电话未配置或仍为占位值（用户中心客服入口将不可用）"
fi

# ============================================================
# 6. 隐私弹窗与协议
# ============================================================
section "6. 隐私弹窗与协议"

PRIVACY_AGREEMENT=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='agreement_privacy';")
if [[ -n "$PRIVACY_AGREEMENT" ]]; then
    CONTENT_LEN=${#PRIVACY_AGREEMENT}
    if [[ $CONTENT_LEN -lt 50 ]]; then
        warn "隐私协议内容过短（${CONTENT_LEN} 字符），可能未完整填写"
    else
        pass "隐私协议已配置（${CONTENT_LEN} 字符）"
    fi
else
    blocker "隐私协议未配置（微信提审必须项）"
fi

REGISTER_AGREEMENT=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='agreement_register';")
if [[ -n "$REGISTER_AGREEMENT" ]]; then
    pass "用户协议已配置"
else
    warn "用户协议未配置（登录页协议勾选将显示空内容）"
fi

# ============================================================
# 7. 站点基础配置
# ============================================================
section "7. 站点基础配置"

SITE_NAME=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='home_site_name';")
if [[ -n "$SITE_NAME" ]]; then
    pass "站点名称: ${SITE_NAME}"
else
    warn "站点名称未配置"
fi

SEARCH_KEYWORDS=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='home_search_keywords';")
if [[ -n "$SEARCH_KEYWORDS" ]]; then
    pass "搜索关键词已配置"
else
    warn "搜索关键词未配置（首页搜索栏将为空）"
fi

# ============================================================
# 8. 支付方式配置
# ============================================================
section "8. 支付方式配置"

PAYMENT_COUNT=$(mysql_query "SELECT COUNT(*) FROM ${DB_PREFIX}payment WHERE is_enable=1 AND is_open_user=1;")
PAYMENT_COUNT=${PAYMENT_COUNT:-0}
if [[ "$PAYMENT_COUNT" -gt 0 ]]; then
    pass "已启用支付方式: ${PAYMENT_COUNT} 个"
else
    warn "无已启用的支付方式（商品下单将无法完成支付，体验版可接受）"
fi

# ============================================================
# 9. API 健康检查（可选）
# ============================================================
if [[ -n "$API_URL" ]]; then
    section "9. API 健康检查"

    API_ENDPOINTS=(
        "api.php?s=index/index|首页配置"
        "api.php?s=activity/index|活动列表"
        "api.php?s=goods/search|商品搜索"
        "api.php?s=feedback/index|反馈列表"
        "api.php?s=invite/info|邀请信息"
        "api.php?s=featureswitch/list|功能开关"
    )

    for ep in "${API_ENDPOINTS[@]}"; do
        PATH_PART="${ep%%|*}"
        DESC="${ep##*|}"
        FULL_URL="${API_URL%/}/${PATH_PART}"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$FULL_URL" 2>/dev/null || echo "000")
        if [[ "$HTTP_CODE" == "200" ]]; then
            pass "API: ${DESC} → HTTP ${HTTP_CODE}"
        elif [[ "$HTTP_CODE" == "000" ]]; then
            blocker "API: ${DESC} → 连接失败"
        else
            warn "API: ${DESC} → HTTP ${HTTP_CODE}"
        fi
    done
fi

# ============================================================
# 汇总
# ============================================================
section "检查汇总"

TOTAL=$((PASS_COUNT + WARN_COUNT + BLOCK_COUNT))
echo -e "  ${C_PASS}PASS: ${PASS_COUNT}${C_RESET}  ${C_WARN}WARN: ${WARN_COUNT}${C_RESET}  ${C_BLOCK}BLOCKER: ${BLOCK_COUNT}${C_RESET}  总计: ${TOTAL}"
echo ""

if [[ $BLOCK_COUNT -gt 0 ]]; then
    echo -e "${C_BLOCK}存在 ${BLOCK_COUNT} 个 BLOCKER → 关键配置缺失，不可发布${C_RESET}"
    echo ""
    echo "  修复后重新运行:"
    echo "    bash scripts/preflight/check-runtime-config.sh --env /path/to/.env"
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "${C_WARN}存在 ${WARN_COUNT} 个 WARN → 可运行但部分功能受限${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}全部通过 → 运行时配置完整${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
fi
