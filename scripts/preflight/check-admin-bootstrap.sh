#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 后台管理初始化检查
# ============================================================
#
# 【用途】检查后台管理入口是否可用、菜单是否完整、
#        关键功能页面是否可访问
# 【用法】bash check-admin-bootstrap.sh [选项]
# 【选项】
#   --url URL    后台管理 URL（如 https://your-domain/admin.php）
#   --cookie STR 登录后的 cookie（如 "PHPSESSID=xxx"）
#   --no-color   关闭彩色输出
#   --help       显示帮助
#
# 【输出等级】PASS / WARN / BLOCKER
# 【退出码】0=无 BLOCKER，1=存在 BLOCKER
#
# 【注意】如不提供 --url 和 --cookie，则只做静态文件检查
# ============================================================

set -uo pipefail

ADMIN_URL=""
ADMIN_COOKIE=""
NO_COLOR=0

for arg in "$@"; do
    case "$arg" in
        --url=*)     ADMIN_URL="${arg#*=}"; shift ;;
        --url)       ADMIN_URL="${2:-}"; shift 2 ;;
        --cookie=*)  ADMIN_COOKIE="${arg#*=}"; shift ;;
        --cookie)    ADMIN_COOKIE="${2:-}"; shift 2 ;;
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

REPO_PATH="${1:-.}"

section "后台管理初始化检查"

# ============================================================
# 1. 后台入口文件检查
# ============================================================
section "1. 后台入口文件"

ADMIN_PHP=$(find "$REPO_PATH" -path '*/shopxo-backend/public/admin*.php' -not -path '*/.git/*' -not -path '*/vendor/*' 2>/dev/null | head -1)
if [[ -n "$ADMIN_PHP" ]]; then
    ADMIN_NAME=$(basename "$ADMIN_PHP")
    pass "后台入口文件存在: public/${ADMIN_NAME}"
else
    warn "未找到 public/admin*.php（可能尚未完成安装，或入口已重命名为非 admin 前缀）"
fi

# install.php
INSTALL_PHP=$(find "$REPO_PATH" -path '*/shopxo-backend/public/install.php' -not -path '*/.git/*' 2>/dev/null | head -1)
if [[ -n "$INSTALL_PHP" ]]; then
    warn "public/install.php 仍存在（安装完成后应删除）"
else
    pass "public/install.php 已删除"
fi

# ============================================================
# 2. 后台控制器文件检查
# ============================================================
section "2. 后台控制器完整性"

REQUIRED_CONTROLLERS=(
    "Featureswitch|功能开关"
    "Inviteconfig|邀请配置"
    "Feedback|反馈审核"
    "Activity|活动管理"
    "Activitysignup|活动报名"
    "Agreement|协议管理"
    "Invite|邀请奖励"
    "Muyingstat|禧孕统计"
    "Site|站点设置"
    "Config|系统配置"
    "Goods|商品管理"
    "Article|文章管理"
    "Payment|支付管理"
    "Order|订单管理"
)

CTRL_DIR=$(find "$REPO_PATH" -path '*/shopxo-backend/app/admin/controller' -not -path '*/.git/*' 2>/dev/null | head -1)

if [[ -n "$CTRL_DIR" ]]; then
    for item in "${REQUIRED_CONTROLLERS[@]}"; do
        CTRL="${item%%|*}"
        DESC="${item##*|}"
        if [[ -f "${CTRL_DIR}/${CTRL}.php" ]]; then
            pass "控制器存在: ${CTRL}.php (${DESC})"
        else
            blocker "控制器缺失: ${CTRL}.php (${DESC})"
        fi
    done
else
    blocker "未找到后台控制器目录"
fi

# ============================================================
# 3. 后台视图文件检查
# ============================================================
section "3. 后台视图完整性"

REQUIRED_VIEWS=(
    "featureswitch/index.html|功能开关页面"
    "inviteconfig/index.html|邀请配置页面"
    "feedback/index.html|反馈列表页面"
    "feedback/detail.html|反馈详情页面"
    "activity/index.html|活动列表页面"
    "activity/saveinfo.html|活动编辑页面"
    "agreement/register.html|注册协议页面"
    "agreement/privacy.html|隐私协议页面"
    "site/siteset/index.html|站点设置页面"
)

VIEW_DIR=$(find "$REPO_PATH" -path '*/shopxo-backend/app/admin/view/default' -not -path '*/.git/*' 2>/dev/null | head -1)

if [[ -n "$VIEW_DIR" ]]; then
    for item in "${REQUIRED_VIEWS[@]}"; do
        VIEW="${item%%|*}"
        DESC="${item##*|}"
        if [[ -f "${VIEW_DIR}/${VIEW}" ]]; then
            pass "视图存在: ${VIEW} (${DESC})"
        else
            blocker "视图缺失: ${VIEW} (${DESC})"
        fi
    done
else
    blocker "未找到后台视图目录"
fi

# ============================================================
# 4. 菜单权限 SQL 检查
# ============================================================
section "4. 菜单权限数据"

MUYING_SQL=$(find "$REPO_PATH" -path '*/shopxo-backend/sql/*muying*menu*' -o -path '*/shopxo-backend/sql/*power*' -o -path '*/docs/*menu*' -o -path '*/docs/*power*' 2>/dev/null | head -1)
if [[ -n "$MUYING_SQL" ]]; then
    pass "找到菜单权限 SQL: ${MUYING_SQL}"
else
    warn "未找到禧孕菜单权限 SQL 文件（需确认 sxo_power 表中是否有 muying_index 菜单组）"
fi

# ============================================================
# 5. 后台页面可访问性检查（在线模式）
# ============================================================
if [[ -n "$ADMIN_URL" ]] && [[ -n "$ADMIN_COOKIE" ]]; then
    section "5. 后台页面可访问性（在线检查）"

    ADMIN_PAGES=(
        "featureswitch/index|功能开关"
        "inviteconfig/index|邀请配置"
        "feedback/index|反馈审核"
        "activity/index|活动管理"
        "agreement/index|协议管理"
        "site/index|站点设置"
        "goods/index|商品管理"
        "payment/index|支付管理"
    )

    for item in "${ADMIN_PAGES[@]}"; do
        PAGE="${item%%|*}"
        DESC="${item##*|}"
        FULL_URL="${ADMIN_URL%/}/${PAGE}.html"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "Cookie: ${ADMIN_COOKIE}" "$FULL_URL" 2>/dev/null || echo "000")
        if [[ "$HTTP_CODE" == "200" ]]; then
            pass "页面可访问: ${DESC}"
        elif [[ "$HTTP_CODE" == "302" || "$HTTP_CODE" == "301" ]]; then
            warn "页面重定向: ${DESC}（可能未登录）"
        elif [[ "$HTTP_CODE" == "000" ]]; then
            blocker "页面不可达: ${DESC}（连接失败）"
        else
            warn "页面返回 ${HTTP_CODE}: ${DESC}"
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
    echo -e "${C_BLOCK}存在 ${BLOCK_COUNT} 个 BLOCKER → 后台不完整，不可交付${C_RESET}"
    echo ""
    echo "  修复后重新运行:"
    echo "    bash scripts/preflight/check-admin-bootstrap.sh ."
    echo "    bash scripts/preflight/check-admin-bootstrap.sh --url https://your-domain/admin --cookie 'PHPSESSID=xxx' ."
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "${C_WARN}存在 ${WARN_COUNT} 个 WARN → 可运行但需关注${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}全部通过 → 后台管理完整${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
fi
