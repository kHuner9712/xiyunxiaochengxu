#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 发布占位符与配置值检查
# ============================================================
#
# 【用途】检查 manifest.json / project.config.json / .env / 后端 .env
#        中是否仍为空值、测试值、占位值，以及是否仍使用 IP 而非正式域名
# 【用法】bash check-release-placeholders.sh [选项] /path/to/repo
# 【选项】
#   --mode=experience  体验版模式（允许测试号 AppID + IP，默认）
#   --mode=submit      提审模式（要求正式 AppID + HTTPS 域名）
#   --no-color         关闭彩色输出
#   --help             显示帮助
#
# 【输出等级】
#   PASS    — 已配置且合规
#   WARN    — 可运行但不合规（体验版允许，提审阻断）
#   BLOCKER — 阻断发布
#
# 【退出码】
#   0 — 无 BLOCKER
#   1 — 存在 BLOCKER
# ============================================================

set -uo pipefail

REPO_PATH="."
MODE="experience"
NO_COLOR=0

for arg in "$@"; do
    case "$arg" in
        --mode=*)   MODE="${arg#*=}"; shift ;;
        --no-color) NO_COLOR=1; shift ;;
        --help|-h)  head -22 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        -*)         echo "未知选项: $arg" >&2; exit 1 ;;
        *)          REPO_PATH="$arg"; shift ;;
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

section "发布占位符与配置值检查 (模式: ${MODE})"

# ============================================================
# 1. manifest.json 检查
# ============================================================
section "1. manifest.json"

MANIFEST=$(find "$REPO_PATH" -path '*/shopxo-uniapp/manifest.json' -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -1)

if [[ -n "$MANIFEST" ]]; then
    # mp-weixin.appid
    WX_APPID=$(python3 -c "
import json,sys
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
print(d.get('mp-weixin',{}).get('appid',''))
" 2>/dev/null || echo "")

    if [[ -z "$WX_APPID" ]]; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "manifest.json mp-weixin.appid 为空（提审必须填写正式 AppID）"
        else
            warn "manifest.json mp-weixin.appid 为空（体验版可用测试号，提审前必须替换）"
        fi
    else
        pass "manifest.json mp-weixin.appid = ${WX_APPID}"
    fi

    # versionName
    VER=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
print(d.get('versionName',''))
" 2>/dev/null || echo "")
    if [[ "$VER" == "0.0.0" || -z "$VER" ]]; then
        blocker "manifest.json versionName = '${VER}'（版本号不能为 0.0.0 或空）"
    else
        pass "manifest.json versionName = ${VER}"
    fi

    # requiredPrivateInfos
    RPI=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
rpi=d.get('mp-weixin',{}).get('requiredPrivateInfos',[])
print(','.join(rpi))
" 2>/dev/null || echo "")
    if [[ -z "$RPI" ]]; then
        warn "manifest.json requiredPrivateInfos 为空（如需位置权限请补充）"
    else
        pass "manifest.json requiredPrivateInfos = [${RPI}]"
    fi
else
    blocker "未找到 manifest.json"
fi

# ============================================================
# 2. project.config.json 检查
# ============================================================
section "2. project.config.json"

PROJ_CFG=$(find "$REPO_PATH" -path '*/shopxo-uniapp/project.config.json' -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -1)

if [[ -n "$PROJ_CFG" ]]; then
    PROJ_APPID=$(python3 -c "
import json
d=json.load(open('$PROJ_CFG','r',encoding='utf-8'))
print(d.get('appid',''))
" 2>/dev/null || echo "")

    if [[ -z "$PROJ_APPID" ]]; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "project.config.json appid 为空（提审必须填写正式 AppID）"
        else
            warn "project.config.json appid 为空（体验版可用测试号）"
        fi
    else
        pass "project.config.json appid = ${PROJ_APPID}"
    fi
else
    blocker "未找到 project.config.json"
fi

# ============================================================
# 3. 前端 .env.production 检查
# ============================================================
section "3. 前端 .env.production"

FE_ENV=$(find "$REPO_PATH" -path '*/shopxo-uniapp/.env.production' -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null | head -1)
FE_ENV_EXAMPLE=$(find "$REPO_PATH" -path '*/shopxo-uniapp/.env.production.example' -not -path '*/.git/*' 2>/dev/null | head -1)

if [[ -n "$FE_ENV" ]]; then
    FE_URL=$(grep -i "^UNI_APP_REQUEST_URL" "$FE_ENV" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' "' | tr -d "'")
    FE_WX_APPID=$(grep -i "^UNI_APP_WX_APPID" "$FE_ENV" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' "' | tr -d "'")

    if [[ -z "$FE_URL" ]]; then
        blocker "前端 .env.production 中 UNI_APP_REQUEST_URL 为空"
    elif echo "$FE_URL" | grep -qE '(你的|example|placeholder)'; then
        blocker "前端 .env.production 中 UNI_APP_REQUEST_URL 仍为占位值: ${FE_URL}"
    elif echo "$FE_URL" | grep -qE '^https?://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "前端 .env.production 中 UNI_APP_REQUEST_URL 使用 IP: ${FE_URL}（提审必须使用 HTTPS 域名）"
        else
            warn "前端 .env.production 中 UNI_APP_REQUEST_URL 使用 IP: ${FE_URL}（体验版允许，提审前需替换为 HTTPS 域名）"
        fi
    elif echo "$FE_URL" | grep -qE '^http://'; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "前端 .env.production 中 UNI_APP_REQUEST_URL 使用 HTTP: ${FE_URL}（提审必须使用 HTTPS）"
        else
            warn "前端 .env.production 中 UNI_APP_REQUEST_URL 使用 HTTP: ${FE_URL}（体验版允许，提审前需改为 HTTPS）"
        fi
    else
        pass "前端 .env.production UNI_APP_REQUEST_URL = ${FE_URL}"
    fi

    if [[ -z "$FE_WX_APPID" || "$FE_WX_APPID" == "你的正式AppID" ]]; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "前端 .env.production 中 UNI_APP_WX_APPID 未配置（提审必须填写）"
        else
            warn "前端 .env.production 中 UNI_APP_WX_APPID 未配置（体验版可用测试号）"
        fi
    else
        pass "前端 .env.production UNI_APP_WX_APPID = ${FE_WX_APPID}"
    fi
else
    if [[ -n "$FE_ENV_EXAMPLE" ]]; then
        blocker "前端 .env.production 不存在（只有 .example 文件，需复制并填写实际值）"
    else
        warn "未找到前端 .env.production 文件"
    fi
fi

# ============================================================
# 4. 后端 .env 检查
# ============================================================
section "4. 后端 .env"

BE_ENV=$(find "$REPO_PATH" -path '*/shopxo-backend/.env' -not -path '*/.git/*' -not -path '*/vendor/*' 2>/dev/null | head -1)

if [[ -n "$BE_ENV" ]]; then
    # APP_DEBUG
    DEBUG_VAL=$(grep -i "^APP_DEBUG" "$BE_ENV" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ' | tr '[:upper:]' '[:lower:]')
    if [[ "$DEBUG_VAL" == "true" || "$DEBUG_VAL" == "1" ]]; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "后端 .env APP_DEBUG = true（提审/正式环境必须为 false）"
        else
            warn "后端 .env APP_DEBUG = true（体验版允许，提审前必须改为 false）"
        fi
    else
        pass "后端 .env APP_DEBUG = ${DEBUG_VAL:-false}"
    fi

    # 数据库占位符
    for key in DB_HOST DB_NAME DB_USER DB_PASS; do
        VAL=$(grep -i "^${key}" "$BE_ENV" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' "' | tr -d "'")
        if echo "$VAL" | grep -qE '(\{\{.*\}\}|你的|example|placeholder|CHANGE_ME)'; then
            blocker "后端 .env ${key} 仍为占位值: ${VAL}"
        elif [[ -z "$VAL" ]]; then
            warn "后端 .env ${key} 为空"
        else
            pass "后端 .env ${key} 已配置"
        fi
    done
else
    BE_ENV_EX=$(find "$REPO_PATH" -path '*/shopxo-backend/.env.production.example' -not -path '*/.git/*' 2>/dev/null | head -1)
    if [[ -n "$BE_ENV_EX" ]]; then
        blocker "后端 .env 不存在（只有 .example 文件，需复制并填写实际值）"
    else
        warn "未找到后端 .env 文件"
    fi
fi

# ============================================================
# 5. install.php 检查
# ============================================================
section "5. 安全文件检查"

INSTALL_PHP=$(find "$REPO_PATH" -path '*/shopxo-backend/public/install.php' -not -path '*/.git/*' 2>/dev/null | head -1)
if [[ -n "$INSTALL_PHP" ]]; then
    if [[ "$MODE" == "submit" ]]; then
        blocker "public/install.php 仍存在（提审前必须删除）"
    else
        warn "public/install.php 仍存在（体验版允许，提审前必须删除）"
    fi
else
    pass "public/install.php 已删除"
fi

# 后台入口重命名
ADMIN_PHP=$(find "$REPO_PATH" -path '*/shopxo-backend/public/admin*.php' -not -path '*/.git/*' 2>/dev/null | head -1)
if [[ -n "$ADMIN_PHP" ]]; then
    ADMIN_NAME=$(basename "$ADMIN_PHP")
    if [[ "$ADMIN_NAME" == "admin.php" ]]; then
        if [[ "$MODE" == "submit" ]]; then
            blocker "后台入口仍为 admin.php（提审前必须重命名）"
        else
            warn "后台入口仍为 admin.php（体验版允许，提审前必须重命名）"
        fi
    else
        pass "后台入口已重命名: ${ADMIN_NAME}"
    fi
else
    warn "未找到后台入口文件 public/admin*.php"
fi

# ============================================================
# 汇总
# ============================================================
section "检查汇总"

TOTAL=$((PASS_COUNT + WARN_COUNT + BLOCK_COUNT))
echo -e "  ${C_PASS}PASS: ${PASS_COUNT}${C_RESET}  ${C_WARN}WARN: ${WARN_COUNT}${C_RESET}  ${C_BLOCK}BLOCKER: ${BLOCK_COUNT}${C_RESET}  总计: ${TOTAL}"
echo ""

if [[ $BLOCK_COUNT -gt 0 ]]; then
    echo -e "${C_BLOCK}存在 ${BLOCK_COUNT} 个 BLOCKER → 不可发布${C_RESET}"
    echo ""
    echo "  体验版 BLOCKER 修复后重新运行:"
    echo "    bash scripts/preflight/check-release-placeholders.sh --mode=experience ."
    echo ""
    echo "  提审前 BLOCKER 修复后重新运行:"
    echo "    bash scripts/preflight/check-release-placeholders.sh --mode=submit ."
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "${C_WARN}存在 ${WARN_COUNT} 个 WARN → 当前模式可发布，但提审前需修复${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}全部通过 → 可发布${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
fi
