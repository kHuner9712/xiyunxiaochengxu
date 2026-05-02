#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 部署后自动验收脚本
# ============================================================
#
# 【用途】服务器部署完成后，自动检查后端健康、数据库完整性、
#        关键配置、支付兜底，输出 PASS/WARN/BLOCKER 结论
# 【用法】bash post-deploy-check.sh [选项]
# 【选项】
#   --site-dir PATH   站点目录（必填）
#   --api-url URL     后端 API 基础 URL（如 http://1.2.3.4/）
#   --db-host HOST    数据库主机（默认 127.0.0.1）
#   --db-port PORT    数据库端口（默认 3306）
#   --db-name NAME    数据库名（必填）
#   --db-user USER    数据库用户（必填）
#   --db-pass PASS    数据库密码（必填）
#   --env=experience  体验版模式（默认）
#   --env=submit      提审模式
#   --help            显示帮助
#
# 【退出码】0=无 BLOCKER，1=存在 BLOCKER
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR=""
API_URL=""
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME=""
DB_USER=""
DB_PASS=""
DEPLOY_ENV="experience"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --site-dir=*) SITE_DIR="${1#*=}"; shift ;;
        --site-dir)   SITE_DIR="${2:-}"; shift 2 ;;
        --api-url=*)  API_URL="${1#*=}"; shift ;;
        --api-url)    API_URL="${2:-}"; shift 2 ;;
        --db-host=*)  DB_HOST="${1#*=}"; shift ;;
        --db-port=*)  DB_PORT="${1#*=}"; shift ;;
        --db-name=*)  DB_NAME="${1#*=}"; shift ;;
        --db-user=*)  DB_USER="${1#*=}"; shift ;;
        --db-pass=*)  DB_PASS="${1#*=}"; shift ;;
        --env=*)      DEPLOY_ENV="${1#*=}"; shift ;;
        --help|-h)    head -28 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *)            shift ;;
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

section() {
    echo ""
    echo "=========================================="
    echo " $1"
    echo "=========================================="
}

if [[ -z "$SITE_DIR" ]]; then blocker "--site-dir 必填"; fi
if [[ -z "$DB_NAME" ]]; then blocker "--db-name 必填"; fi
if [[ -z "$DB_USER" ]]; then blocker "--db-user 必填"; fi

MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"
if [[ -n "$DB_PASS" ]]; then
    MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  部署后自动验收 (模式: ${DEPLOY_ENV})"
echo "═══════════════════════════════════════════════════════════════"

# ============================================================
# A. 文件系统检查
# ============================================================
section "A. 文件系统检查"

if [[ -n "$SITE_DIR" ]]; then
    # 入口文件
    for f in "public/index.php" "public/api.php"; do
        if [[ -f "${SITE_DIR}/${f}" ]]; then
            pass "入口文件存在: ${f}"
        else
            blocker "入口文件缺失: ${f}"
        fi
    done

    # install.php
    if [[ -f "${SITE_DIR}/public/install.php" ]]; then
        if [[ "$DEPLOY_ENV" == "submit" ]]; then
            blocker "public/install.php 仍存在（提审前必须删除）"
        else
            warn "public/install.php 仍存在（体验版允许，提审前删除）"
        fi
    else
        pass "public/install.php 已删除"
    fi

    # .env
    if [[ -f "${SITE_DIR}/.env" ]]; then
        pass ".env 文件存在"
        DEBUG_VAL=$(grep -i "^APP_DEBUG" "${SITE_DIR}/.env" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ' | tr '[:upper:]' '[:lower:]')
        if [[ "$DEPLOY_ENV" == "submit" && ("$DEBUG_VAL" == "true" || "$DEBUG_VAL" == "1") ]]; then
            blocker "APP_DEBUG = true（提审模式必须为 false）"
        elif [[ "$DEPLOY_ENV" == "experience" && ("$DEBUG_VAL" == "true" || "$DEBUG_VAL" == "1") ]]; then
            warn "APP_DEBUG = true（体验版允许，提审前改 false）"
        else
            pass "APP_DEBUG = ${DEBUG_VAL:-false}"
        fi
    else
        blocker ".env 文件不存在"
    fi

    # 关键目录权限
    for dir in "runtime" "public/upload" "config"; do
        FULL="${SITE_DIR}/${dir}"
        if [[ -d "$FULL" ]]; then
            PERM=$(stat -c "%a" "$FULL" 2>/dev/null || stat -f "%Lp" "$FULL" 2>/dev/null || echo "???")
            if [[ "$PERM" == "777" ]]; then
                warn "${dir}/ 权限为 777（不安全，建议改为 755）"
            else
                pass "${dir}/ 权限 ${PERM}"
            fi
        else
            blocker "目录缺失: ${dir}/"
        fi
    done
fi

# ============================================================
# B. 数据库检查
# ============================================================
section "B. 数据库检查"

if command -v mysql &>/dev/null; then
    if $MYSQL_CMD -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
        pass "数据库连接成功"

        # 必需表
        REQUIRED_TABLES="activity activity_signup invite_reward muying_feedback config payment user"
        for table in $REQUIRED_TABLES; do
            COUNT=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='sxo_${table}';" "$DB_NAME" 2>/dev/null || echo "0")
            if [[ "${COUNT:-0}" -gt 0 ]]; then
                pass "表存在: sxo_${table}"
            else
                blocker "表缺失: sxo_${table}（迁移 SQL 可能未执行）"
            fi
        done

        # 关键配置
        CRITICAL_CONFIGS="feature_activity_enabled feature_invite_enabled feature_feedback_enabled"
        for tag in $CRITICAL_CONFIGS; do
            COUNT=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM sxo_config WHERE only_tag='${tag}';" "$DB_NAME" 2>/dev/null || echo "0")
            if [[ "${COUNT:-0}" -gt 0 ]]; then
                pass "配置存在: ${tag}"
            else
                warn "配置缺失: ${tag}（功能开关可能未初始化）"
            fi
        done

        # 支付方式
        PAY_COUNT=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM sxo_payment WHERE is_enable=1 AND is_open_user=1;" "$DB_NAME" 2>/dev/null || echo "0")
        if [[ "${PAY_COUNT:-0}" -gt 0 ]]; then
            pass "已启用支付方式: ${PAY_COUNT} 个"
        else
            if [[ "$DEPLOY_ENV" == "submit" ]]; then
                blocker "无已启用支付方式（正式版必须配置支付）"
            else
                warn "无已启用支付方式（体验版可接受，前端已兜底提示）"
            fi
        fi

        # 后台菜单
        POWER_COUNT=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM sxo_power WHERE name='禧孕运营';" "$DB_NAME" 2>/dev/null || echo "0")
        if [[ "${POWER_COUNT:-0}" -gt 0 ]]; then
            pass "后台菜单已注册（禧孕运营）"
        else
            blocker "后台菜单未注册（需执行 muying-admin-power-migration.sql）"
        fi
    else
        blocker "数据库连接失败"
    fi
else
    warn "mysql CLI 不可用，跳过数据库检查"
fi

# ============================================================
# C. API 健康检查
# ============================================================
if [[ -n "$API_URL" ]]; then
    section "C. API 健康检查"

    API_CHECKS=(
        "api.php?s=common.index.index|首页配置"
        "api.php?s=activity/index|活动列表"
        "api.php?s=goods/search|商品搜索"
        "api.php?s=featureswitch/list|功能开关"
    )

    for item in "${API_CHECKS[@]}"; do
        PATH_PART="${item%%|*}"
        DESC="${item##*|}"
        FULL_URL="${API_URL%/}/${PATH_PART}"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$FULL_URL" 2>/dev/null || echo "000")
        if [[ "$HTTP_CODE" == "200" ]]; then
            pass "API: ${DESC} → HTTP 200"
        elif [[ "$HTTP_CODE" == "000" ]]; then
            blocker "API: ${DESC} → 连接失败"
        else
            warn "API: ${DESC} → HTTP ${HTTP_CODE}"
        fi
    done
fi

# ============================================================
# D. RC Gate 脚本调用
# ============================================================
section "D. RC Gate 检查"

PREFLIGHT_DIR="${SCRIPT_DIR}/../preflight"
if [[ -f "${PREFLIGHT_DIR}/run-rc-gate.sh" ]]; then
    RC_ARGS=("--repo" "$(cd "${SITE_DIR}/.." && pwd)" "--env=${DEPLOY_ENV}" "--skip-legacy")
    if [[ -n "$DB_PASS" ]]; then
        RC_ARGS+=("--env" "${SITE_DIR}/.env")
    fi
    bash "${PREFLIGHT_DIR}/run-rc-gate.sh" "${RC_ARGS[@]}" 2>&1 | tail -20
    RC_EXIT=$?
    if [[ $RC_EXIT -ne 0 ]]; then
        warn "RC Gate 检查存在 BLOCKER（详见上方输出）"
    else
        pass "RC Gate 检查通过"
    fi
else
    warn "RC Gate 脚本不存在，跳过"
fi

# ============================================================
# E. 支付兜底检查
# ============================================================
section "E. 支付兜底检查"

if [[ -f "${SITE_DIR}/app/service/BuyService.php" ]]; then
    if grep -q "支付功能暂未开通" "${SITE_DIR}/app/service/BuyService.php"; then
        pass "后端 BuyService 已包含支付未配置兜底"
    else
        warn "后端 BuyService 未包含支付未配置兜底（用户可能看到'支付方式有误'）"
    fi
fi

if [[ -n "$SITE_DIR" && -f "${SITE_DIR}/../shopxo-uniapp/pages/buy/buy.vue" ]]; then
    if grep -q "支付功能暂未开通" "${SITE_DIR}/../shopxo-uniapp/pages/buy/buy.vue"; then
        pass "前端 buy.vue 已包含支付未配置兜底"
    else
        warn "前端 buy.vue 未包含支付未配置兜底"
    fi
fi

# ============================================================
# 最终结论
# ============================================================
section "验收结论"

TOTAL=$((PASS_COUNT + WARN_COUNT + BLOCK_COUNT))
echo -e "  ${C_PASS}PASS: ${PASS_COUNT}${C_RESET}  ${C_WARN}WARN: ${WARN_COUNT}${C_RESET}  ${C_BLOCK}BLOCKER: ${BLOCK_COUNT}${C_RESET}"

echo ""
if [[ $BLOCK_COUNT -gt 0 ]]; then
    echo -e "${C_BLOCK}结论: 不可上线 — 存在 ${BLOCK_COUNT} 个 BLOCKER${C_RESET}"
    echo ""
    echo "  请修复 BLOCKER 后重新运行:"
    echo "    bash scripts/deploy/post-deploy-check.sh --site-dir /path/to/site --db-name xxx --db-user xxx --db-pass xxx --env=${DEPLOY_ENV}"
    echo ""
    exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "${C_WARN}结论: 可上线（有 ${WARN_COUNT} 个 WARN）${C_RESET}"
    echo ""
    if [[ "$DEPLOY_ENV" == "experience" ]]; then
        echo "  ✅ 体验版可进入下一步：编译上传体验版"
        echo "  📋 执行 smoke test: docs/release/experience-smoke-test.md"
    else
        echo "  ⚠ 提审版需确认 WARN 项不影响审核"
    fi
    echo ""
    exit 0
else
    echo -e "${C_PASS}结论: 全部通过 — 可上线${C_RESET}"
    echo ""
    exit 0
fi
