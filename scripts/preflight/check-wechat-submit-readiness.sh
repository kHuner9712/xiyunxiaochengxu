#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 微信提审就绪检查
# ============================================================
#
# 【用途】检查微信小程序提审前所有必要条件是否已满足
#        包括权限、隐私、合法域名、材料等
# 【用法】bash check-wechat-submit-readiness.sh [选项] /path/to/repo
# 【选项】
#   --no-color   关闭彩色输出
#   --help       显示帮助
#
# 【输出等级】PASS / WARN / BLOCKER
# 【退出码】0=无 BLOCKER，1=存在 BLOCKER
#
# 【注意】本脚本只检查代码仓库中的静态文件，
#        微信公众平台后台配置需人工确认
# ============================================================

set -uo pipefail

REPO_PATH="."
NO_COLOR=0

for arg in "$@"; do
    case "$arg" in
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

section "微信提审就绪检查"

# ============================================================
# 1. AppID 检查
# ============================================================
section "1. AppID 配置"

MANIFEST=$(find "$REPO_PATH" -path '*/shopxo-uniapp/manifest.json' -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -1)
PROJ_CFG=$(find "$REPO_PATH" -path '*/shopxo-uniapp/project.config.json' -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -1)

WX_APPID=""
PROJ_APPID=""

if [[ -n "$MANIFEST" ]]; then
    WX_APPID=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
print(d.get('mp-weixin',{}).get('appid',''))
" 2>/dev/null || echo "")
fi

if [[ -n "$PROJ_CFG" ]]; then
    PROJ_APPID=$(python3 -c "
import json
d=json.load(open('$PROJ_CFG','r',encoding='utf-8'))
print(d.get('appid',''))
" 2>/dev/null || echo "")
fi

if [[ -z "$WX_APPID" ]]; then
    blocker "manifest.json mp-weixin.appid 为空（提审必须填写正式 AppID）"
else
    pass "manifest.json mp-weixin.appid = ${WX_APPID}"
fi

if [[ -z "$PROJ_APPID" ]]; then
    blocker "project.config.json appid 为空（提审必须填写正式 AppID）"
else
    pass "project.config.json appid = ${PROJ_APPID}"
fi

if [[ -n "$WX_APPID" && -n "$PROJ_APPID" && "$WX_APPID" != "$PROJ_APPID" ]]; then
    blocker "manifest.json 和 project.config.json 的 AppID 不一致: ${WX_APPID} vs ${PROJ_APPID}"
fi

# ============================================================
# 2. 隐私合规检查
# ============================================================
section "2. 隐私合规"

if [[ -n "$MANIFEST" ]]; then
    # __usePrivacyCheck__
    PRIVACY_CHECK=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
print(d.get('mp-weixin',{}).get('__usePrivacyCheck__',False))
" 2>/dev/null || echo "False")

    if [[ "$PRIVACY_CHECK" == "True" || "$PRIVACY_CHECK" == "true" ]]; then
        pass "__usePrivacyCheck__ 已开启"
    else
        blocker "__usePrivacyCheck__ 未开启（微信要求必须开启）"
    fi

    # requiredPrivateInfos
    RPI=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
rpi=d.get('mp-weixin',{}).get('requiredPrivateInfos',[])
print(','.join(rpi) if rpi else '')
" 2>/dev/null || echo "")

    if [[ -n "$RPI" ]]; then
        pass "requiredPrivateInfos = [${RPI}]"
    else
        warn "requiredPrivateInfos 为空（如使用位置权限则需补充）"
    fi

    # permission.scope.userLocation.desc
    LOC_DESC=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
perm=d.get('mp-weixin',{}).get('permission',{})
loc=perm.get('scope.userLocation',{})
print(loc.get('desc',''))
" 2>/dev/null || echo "")

    if [[ -n "$LOC_DESC" ]]; then
        pass "位置权限说明文案: ${LOC_DESC}"
    else
        warn "位置权限说明文案为空（如申请位置权限则必须填写）"
    fi

    # iOS 后台定位声明检查
    IOS_ALWAYS=$(python3 -c "
import json
d=json.load(open('$MANIFEST','r',encoding='utf-8'))
ios=d.get('app-plus',{}).get('distribute',{}).get('ios',{}).get('privacyDescription',{})
for k in ios:
    if 'always' in k.lower() or 'Always' in k:
        print(k)
        break
else:
    print('')
" 2>/dev/null || echo "")

    if [[ -z "$IOS_ALWAYS" ]]; then
        pass "iOS 无后台定位声明（合规）"
    else
        blocker "iOS 存在后台定位声明: ${IOS_ALWAYS}（微信提审会被拒）"
    fi
fi

# ============================================================
# 3. 域名配置检查
# ============================================================
section "3. 域名配置"

FE_ENV=$(find "$REPO_PATH" -path '*/shopxo-uniapp/.env.production' -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null | head -1)

if [[ -n "$FE_ENV" ]]; then
    FE_URL=$(grep -i "^UNI_APP_REQUEST_URL" "$FE_ENV" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' "' | tr -d "'")

    if [[ -z "$FE_URL" ]]; then
        blocker "前端 .env.production 中 UNI_APP_REQUEST_URL 为空"
    elif echo "$FE_URL" | grep -qE '^https://'; then
        if echo "$FE_URL" | grep -qE '^https://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'; then
            blocker "UNI_APP_REQUEST_URL 使用 IP: ${FE_URL}（提审必须使用 HTTPS 域名）"
        else
            pass "UNI_APP_REQUEST_URL 使用 HTTPS 域名: ${FE_URL}"
        fi
    elif echo "$FE_URL" | grep -qE '^http://'; then
        blocker "UNI_APP_REQUEST_URL 使用 HTTP: ${FE_URL}（提审必须使用 HTTPS）"
    else
        blocker "UNI_APP_REQUEST_URL 格式异常: ${FE_URL}"
    fi
else
    blocker "前端 .env.production 不存在"
fi

# ============================================================
# 4. 安全配置检查
# ============================================================
section "4. 安全配置"

# install.php
INSTALL_PHP=$(find "$REPO_PATH" -path '*/shopxo-backend/public/install.php' -not -path '*/.git/*' 2>/dev/null | head -1)
if [[ -n "$INSTALL_PHP" ]]; then
    blocker "public/install.php 仍存在（提审前必须删除）"
else
    pass "public/install.php 已删除"
fi

# APP_DEBUG
BE_ENV=$(find "$REPO_PATH" -path '*/shopxo-backend/.env' -not -path '*/.git/*' -not -path '*/vendor/*' 2>/dev/null | head -1)
if [[ -n "$BE_ENV" ]]; then
    DEBUG_VAL=$(grep -i "^APP_DEBUG" "$BE_ENV" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ' | tr '[:upper:]' '[:lower:]')
    if [[ "$DEBUG_VAL" == "true" || "$DEBUG_VAL" == "1" ]]; then
        blocker "后端 .env APP_DEBUG = true（提审环境必须为 false）"
    else
        pass "后端 .env APP_DEBUG 已关闭"
    fi
fi

# 后台入口
ADMIN_PHP=$(find "$REPO_PATH" -path '*/shopxo-backend/public/admin.php' -not -path '*/.git/*' 2>/dev/null | head -1)
if [[ -n "$ADMIN_PHP" ]]; then
    blocker "后台入口仍为 admin.php（提审前必须重命名）"
else
    ADMIN_OTHER=$(find "$REPO_PATH" -path '*/shopxo-backend/public/admin*.php' -not -path '*/.git/*' 2>/dev/null | head -1)
    if [[ -n "$ADMIN_OTHER" ]]; then
        pass "后台入口已重命名: $(basename "$ADMIN_OTHER")"
    else
        warn "未找到后台入口文件"
    fi
fi

# ============================================================
# 5. 测试/调试内容检查
# ============================================================
section "5. 测试内容残留检查"

TEST_PATTERNS=(
    '测试|test|debug|TODO|FIXME|console\.log'
)

VUE_FILES=$(find "$REPO_PATH/shopxo-uniapp/pages" -name '*.vue' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -50)
TEST_HIT=0
for f in $VUE_FILES; do
    if grep -qE '(console\.log\(|debugger|alert\()' "$f" 2>/dev/null; then
        rel="${f#$REPO_PATH/}"
        warn "调试代码残留: ${rel}"
        TEST_HIT=$((TEST_HIT + 1))
    fi
done

if [[ $TEST_HIT -eq 0 ]]; then
    pass "前端页面无调试代码残留"
fi

# ============================================================
# 6. 微信公众平台人工确认项
# ============================================================
section "6. 微信公众平台人工确认项（脚本无法自动检查）"

MANUAL_ITEMS=(
    "服务类目已选择|微信公众平台 → 设置 → 基本设置 → 服务类目"
    "隐私保护指引已填写|微信公众平台 → 设置 → 服务内容声明"
    "服务器域名已配置|微信公众平台 → 开发管理 → 开发设置 → 服务器域名"
    "小程序基本信息已填写|名称/简介/图标/类目"
    "测试账号已准备|微信公众平台 → 开发管理 → 开发设置 → 版本管理"
)

for item in "${MANUAL_ITEMS[@]}"; do
    DESC="${item%%|*}"
    LOC="${item##*|}"
    warn "[人工确认] ${DESC} → ${LOC}"
done

echo ""
info "以上 5 项需在微信公众平台后台人工确认，脚本无法自动检查"
info "参考文档: docs/release/submission-materials-checklist.md"

# ============================================================
# 汇总
# ============================================================
section "检查汇总"

TOTAL=$((PASS_COUNT + WARN_COUNT + BLOCK_COUNT))
echo -e "  ${C_PASS}PASS: ${PASS_COUNT}${C_RESET}  ${C_WARN}WARN: ${WARN_COUNT}${C_RESET}  ${C_BLOCK}BLOCKER: ${BLOCK_COUNT}${C_RESET}  总计: ${TOTAL}"
echo ""

if [[ $BLOCK_COUNT -gt 0 ]]; then
    echo -e "${C_BLOCK}存在 ${BLOCK_COUNT} 个 BLOCKER → 不可提审${C_RESET}"
    echo ""
    echo "  修复后重新运行:"
    echo "    bash scripts/preflight/check-wechat-submit-readiness.sh ."
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "${C_WARN}存在 ${WARN_COUNT} 个 WARN → 需人工确认后可提审${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}全部通过 → 可提审${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
fi
