#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — 上线前生产环境检查脚本 (Shell 版)
# ============================================================
#
# [MUYING-二开] 一期上线前检查脚本
#
# 【用途】检查生产环境配置是否安全、合规
# 【用法】bash scripts/preflight/preflight-production-check.sh [选项]
# 【选项】
#   --repo PATH      仓库根目录（默认 .）
#   --env FILE       后端 .env 文件路径
#   --no-color       关闭彩色输出
#   --help           显示帮助
#
# 【检查项】（共 10 项）
#   1. APP_DEBUG 是否关闭
#   2. .env / project.private.config / manifest.local 是否 gitignored 且未被跟踪
#   3. 生产 request_url 是否 https
#   4. 高风险 feature flag 是否关闭
#   5. 是否存在测试 AppID
#   6. 是否存在 localhost/127.0.0.1/明文密码等生产风险配置
#   7. AppID 三处一致、非空、非测试号
#   8. 合规白名单文件 compliance-scope.js 与 pages.json 存在性
#   9. 资质门禁模式检查
#  10. install.php 安装入口残留检查
#
# 【输出等级】PASS / WARN / BLOCKER
# 【退出码】0=无 BLOCKER，1=存在 BLOCKER
# ============================================================

set -uo pipefail

REPO_PATH="."
ENV_FILE=""
NO_COLOR=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)     REPO_PATH="$2"; shift 2 ;;
        --env)      ENV_FILE="$2"; shift 2 ;;
        --no-color) NO_COLOR=1; shift ;;
        --help|-h)  head -30 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *)          REPO_PATH="$1"; shift ;;
    esac
done

if [[ $NO_COLOR -eq 1 ]] || [[ ! -t 1 ]]; then
    C_PASS=""; C_WARN=""; C_BLOCK=""; C_RESET=""
else
    C_PASS="\033[32m"; C_WARN="\033[33m"; C_BLOCK="\033[31m"; C_RESET="\033[0m"
fi

PASS_COUNT=0
WARN_COUNT=0
BLOCK_COUNT=0
BLOCKER_ITEMS=()
WARN_ITEMS=()

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "${C_PASS}[PASS]${C_RESET} $1"; }
warn() { WARN_COUNT=$((WARN_COUNT + 1)); echo -e "${C_WARN}[WARN]${C_RESET} $1"; WARN_ITEMS+=("$1"); }
blocker() { BLOCK_COUNT=$((BLOCK_COUNT + 1)); echo -e "${C_BLOCK}[BLOCKER]${C_RESET} $1"; BLOCKER_ITEMS+=("$1"); }
section() { echo ""; echo "=========================================="; echo " $1"; echo "=========================================="; }

if [[ -z "$ENV_FILE" ]] && [[ -f "${REPO_PATH}/shopxo-backend/.env" ]]; then
    ENV_FILE="${REPO_PATH}/shopxo-backend/.env"
fi

echo ""
echo "孕禧小程序 — 上线前生产环境检查"
echo "仓库路径: ${REPO_PATH}"
echo ".env 文件: ${ENV_FILE:-未指定}"
echo ""

# ============================================================
# 1. APP_DEBUG 检查
# ============================================================
section "1. APP_DEBUG 检查"

if [[ -n "$ENV_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    if grep -qi 'APP_DEBUG\s*=\s*true' "$ENV_FILE"; then
        blocker "APP_DEBUG = true，生产环境必须关闭"
    elif grep -qi 'APP_DEBUG\s*=\s*false' "$ENV_FILE"; then
        pass "APP_DEBUG = false，已关闭"
    else
        warn "APP_DEBUG 未在 .env 中显式设置，请确认默认值为 false"
    fi
else
    warn ".env 文件不存在或未指定，无法检查 APP_DEBUG"
fi

# ============================================================
# 2. .env Git 提交检查
# ============================================================
section "2. .env Git 提交检查"

GITIGNORE="${REPO_PATH}/.gitignore"
if [[ -f "$GITIGNORE" ]]; then
    if grep -q '\.env' "$GITIGNORE"; then
        pass ".gitignore 包含 .env 规则"
    else
        blocker ".gitignore 未包含 .env 规则，.env 可能被提交到 Git"
    fi
else
    warn ".gitignore 文件不存在"
fi

# 检查 project.private.config.json / manifest.local.json 是否在 gitignore
if [[ -f "$GITIGNORE" ]]; then
    if grep -q 'project.private.config\|manifest.local' "$GITIGNORE"; then
        pass ".gitignore 包含 project.private.config / manifest.local 规则"
    else
        warn ".gitignore 未包含 project.private.config.json / manifest.local.json 规则"
    fi
fi

# 检查 project.private.config 是否被 Git 跟踪
if command -v git &>/dev/null; then
    if git -C "$REPO_PATH" ls-files | grep -q 'project.private.config\|manifest.local.json$'; then
        blocker "project.private.config.json 或 manifest.local.json 已被 Git 跟踪，应立即从 Git 中移除"
    else
        pass "project.private.config.json / manifest.local.json 未提交到 Git"
    fi
fi

BACKEND_GITIGNORE="${REPO_PATH}/shopxo-backend/.gitignore"
if [[ -f "$BACKEND_GITIGNORE" ]]; then
    if grep -q '\.env' "$BACKEND_GITIGNORE"; then
        pass "shopxo-backend/.gitignore 包含 .env 规则"
    else
        blocker "shopxo-backend/.gitignore 未包含 .env 规则"
    fi
fi

if [[ -n "$ENV_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    ENV_RELATIVE=$(realpath --relative-to="$REPO_PATH" "$ENV_FILE" 2>/dev/null || echo "")
    if [[ -n "$ENV_RELATIVE" ]] && command -v git &>/dev/null; then
        if git -C "$REPO_PATH" ls-files --error-unmatch "$ENV_RELATIVE" &>/dev/null; then
            blocker ".env 文件已被 Git 跟踪: ${ENV_RELATIVE}，必须从版本控制中移除"
        else
            pass ".env 文件未被 Git 跟踪"
        fi
    fi
fi

# ============================================================
# 3. 生产 request_url HTTPS 检查
# ============================================================
section "3. 生产 request_url HTTPS 检查"

PROD_ENV="${REPO_PATH}/shopxo-uniapp/.env.production"
if [[ -f "$PROD_ENV" ]]; then
    REQUEST_URL=$(grep -oP 'UNI_APP_REQUEST_URL\s*=\s*\K.*' "$PROD_ENV" 2>/dev/null | head -1 | xargs)
    if [[ -n "$REQUEST_URL" ]]; then
        if [[ "$REQUEST_URL" == https://* ]]; then
            pass "生产 request_url 使用 HTTPS: ${REQUEST_URL}"
        elif [[ "$REQUEST_URL" == http://* ]]; then
            blocker "生产 request_url 使用 HTTP（不安全）: ${REQUEST_URL}"
        elif [[ "$REQUEST_URL" == *你的* ]] || [[ "$REQUEST_URL" == *'{{'* ]]; then
            blocker "生产 request_url 仍为占位符: ${REQUEST_URL}"
        else
            warn "生产 request_url 格式异常: ${REQUEST_URL}"
        fi
    else
        warn ".env.production 中未找到 UNI_APP_REQUEST_URL"
    fi
else
    if [[ -f "${REPO_PATH}/shopxo-uniapp/.env.production.example" ]]; then
        warn ".env.production 不存在（仅有 .example），请确认已创建正式配置"
    fi
fi

# ============================================================
# 4. 高风险功能开关检查
# ============================================================
section "4. 高风险功能开关检查"

HIGH_RISK_FLAGS=(
    "feature_distribution_enabled|分销/多级返佣"
    "feature_wallet_enabled|钱包/余额/提现"
    "feature_coin_enabled|虚拟币"
    "feature_shop_enabled|第三方商家入驻"
    "feature_realstore_enabled|门店/多门店"
    "feature_hospital_enabled|医疗咨询/问诊"
    "feature_seckill_enabled|秒杀"
    "feature_live_enabled|直播"
    "feature_video_enabled|视频"
)

if [[ -n "$ENV_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    for item in "${HIGH_RISK_FLAGS[@]}"; do
        FLAG="${item%%|*}"
        DESC="${item##*|}"
        if grep -qi "${FLAG}\s*=\s*1" "$ENV_FILE"; then
            blocker "高风险功能开关已启用: ${FLAG}（${DESC}），一期不应启用"
        else
            pass "高风险功能开关已关闭: ${FLAG}（${DESC}）"
        fi
    done
else
    for item in "${HIGH_RISK_FLAGS[@]}"; do
        FLAG="${item%%|*}"
        DESC="${item##*|}"
        warn "无法检查功能开关: ${FLAG}（${DESC}），.env 不可用"
    done
fi

# ============================================================
# 5. 测试 AppID 检查
# ============================================================
section "5. 测试 AppID 检查"

TEST_APPIDS=("wx1234567890" "wx0000000000" "wxdemo" "wxtest" "touristappid")
FOUND_TEST_APPID=0

for file in "${REPO_PATH}/shopxo-uniapp/.env.production" \
             "${REPO_PATH}/shopxo-uniapp/.env.staging" \
             "${REPO_PATH}/shopxo-uniapp/manifest.json" \
             "${REPO_PATH}/shopxo-uniapp/project.config.json"; do
    if [[ ! -f "$file" ]]; then
        continue
    fi
    BASENAME=$(basename "$file")
    for test_id in "${TEST_APPIDS[@]}"; do
        if grep -qi "$test_id" "$file" 2>/dev/null; then
            blocker "发现测试 AppID '${test_id}' 在文件: ${BASENAME}"
            FOUND_TEST_APPID=1
        fi
    done
done

if [[ $FOUND_TEST_APPID -eq 0 ]]; then
    pass "测试 AppID 检查完成，未发现测试 AppID"
fi

# ============================================================
# 6. 生产风险配置检查
# ============================================================
section "6. 生产风险配置检查"

FOUND_RISKS=0

for file in "${REPO_PATH}/shopxo-backend/.env" \
             "${REPO_PATH}/shopxo-uniapp/.env.production"; do
    if [[ ! -f "$file" ]]; then
        continue
    fi
    BASENAME=$(echo "$file" | sed "s|${REPO_PATH}/||")

    if grep -qi 'UNI_APP_REQUEST_URL\s*=.*\(localhost\|127\.0\.0\.1\)' "$file" 2>/dev/null; then
        blocker "生产配置包含本地地址: ${BASENAME} → UNI_APP_REQUEST_URL"
        FOUND_RISKS=1
    fi

    if grep -qiP 'USERNAME\s*=\s*root' "$file" 2>/dev/null; then
        blocker "数据库使用 root 用户: ${BASENAME}"
        FOUND_RISKS=1
    fi

    if grep -qiP 'PASSWORD\s*=\s*(123456|password|root|admin|test)' "$file" 2>/dev/null; then
        blocker "数据库密码为弱密码: ${BASENAME}"
        FOUND_RISKS=1
    fi

    if grep -qiP 'UNI_APP_WX_APPID\s*=\s*(你的|{{)' "$file" 2>/dev/null; then
        blocker "微信 AppID 仍为占位符: ${BASENAME}"
        FOUND_RISKS=1
    fi
done

if [[ $FOUND_RISKS -eq 0 ]]; then
    pass "未发现生产风险配置"
fi

# ============================================================
# 7. AppID 检查（非空、一致性、生产禁止测试号）
# ============================================================
section "7. AppID 检查"

MANIFEST_FILE="${REPO_PATH}/shopxo-uniapp/manifest.json"
PROJ_CFG_FILE="${REPO_PATH}/shopxo-uniapp/project.config.json"
PROD_ENV_FILE="${REPO_PATH}/shopxo-uniapp/.env.production"

MANIFEST_APPID=""
PROJ_APPID=""
ENV_APPID=""

if [[ -f "$MANIFEST_FILE" ]]; then
    MANIFEST_APPID=$(python3 -c "import json; d=json.load(open('$MANIFEST_FILE','r',encoding='utf-8')); print(d.get('mp-weixin',{}).get('appid',''))" 2>/dev/null || echo "")
fi

if [[ -f "$PROJ_CFG_FILE" ]]; then
    PROJ_APPID=$(python3 -c "import json; d=json.load(open('$PROJ_CFG_FILE','r',encoding='utf-8')); print(d.get('appid',''))" 2>/dev/null || echo "")
fi

if [[ -f "$PROD_ENV_FILE" ]]; then
    ENV_APPID=$(grep -oP 'UNI_APP_WX_APPID\s*=\s*\K.*' "$PROD_ENV_FILE" 2>/dev/null | head -1 | xargs)
fi

# [MUYING-二开] 检查 AppID 非空，空值 = BLOCKER
if [[ -z "$MANIFEST_APPID" ]]; then
    blocker "manifest.json → mp-weixin.appid 为空，必须配置正式 AppID"
else
    pass "manifest.json AppID 已配置: ${MANIFEST_APPID}"
fi

if [[ -z "$PROJ_APPID" ]]; then
    blocker "project.config.json → appid 为空，必须配置正式 AppID"
else
    pass "project.config.json AppID 已配置: ${PROJ_APPID}"
fi

if [[ -z "$ENV_APPID" || "$ENV_APPID" == "{{WX_APPID}}" ]]; then
    blocker ".env.production → UNI_APP_WX_APPID 为空或仍为占位符，必须配置正式 AppID"
else
    pass ".env.production AppID 已配置: ${ENV_APPID}"
fi

# [MUYING-二开] 生产环境禁止使用测试号
TEST_PROD_APPID="wxda7779770f53e901"
for loc in "manifest.json:${MANIFEST_APPID}" "project.config.json:${PROJ_APPID}" ".env.production:${ENV_APPID}"; do
    FILE_NAME="${loc%%:*}"
    APPID_VAL="${loc##*:}"
    if [[ "$APPID_VAL" == "$TEST_PROD_APPID" ]]; then
        blocker "${FILE_NAME} 使用了微信测试号 AppID (${TEST_PROD_APPID})，生产环境禁止使用测试号"
    fi
done

# [MUYING-二开] 三处 AppID 一致性检查
if [[ -n "$MANIFEST_APPID" && -n "$PROJ_APPID" && "$MANIFEST_APPID" != "$PROJ_APPID" ]]; then
    blocker "manifest.json AppID (${MANIFEST_APPID}) 与 project.config.json AppID (${PROJ_APPID}) 不一致"
elif [[ -n "$MANIFEST_APPID" && -n "$PROJ_APPID" ]]; then
    pass "manifest.json 与 project.config.json AppID 一致"
fi

if [[ -n "$MANIFEST_APPID" && -n "$ENV_APPID" && "$MANIFEST_APPID" != "$ENV_APPID" ]]; then
    blocker "manifest.json AppID (${MANIFEST_APPID}) 与 .env.production AppID (${ENV_APPID}) 不一致"
elif [[ -n "$MANIFEST_APPID" && -n "$ENV_APPID" ]]; then
    pass "manifest.json 与 .env.production AppID 一致"
fi

# ============================================================
# 8. 前端路由白名单检查（compliance-scope.js）
# ============================================================
section "8. 前端路由白名单检查"

COMPLIANCE_SCOPE="${REPO_PATH}/shopxo-uniapp/common/js/config/compliance-scope.js"
if [[ -f "$COMPLIANCE_SCOPE" ]]; then
    ROUTE_COUNT=$(grep -c "/pages/" "$COMPLIANCE_SCOPE" 2>/dev/null || echo "0")
    if [[ "$ROUTE_COUNT" -gt 0 ]]; then
        pass "compliance-scope.js 路由白名单已配置（注册 ${ROUTE_COUNT} 条路径规则）"
    else
        blocker "compliance-scope.js 存在但未注册任何路由，合规拦截可能误伤"
    fi
else
    blocker "compliance-scope.js 不存在，合规拦截核心文件丢失"
fi

PAGES_JSON="${REPO_PATH}/shopxo-uniapp/pages.json"
if [[ -f "$PAGES_JSON" ]]; then
    SUBPACKAGE_COUNT=$(grep -c '"root":' "$PAGES_JSON" 2>/dev/null || echo "0")
    pass "pages.json 已注册 ${SUBPACKAGE_COUNT} 个子包"
else
    blocker "pages.json 文件不存在，前端编译将失败"
fi

ALLOWED_COUNT=$(grep -c '/pages/' "$COMPLIANCE_SCOPE" 2>/dev/null || echo "0")
SUBPKG_COUNT=$(grep -c '"root":' "$PAGES_JSON" 2>/dev/null || echo "0")
echo "  合规白名单路由数: ${ALLOWED_COUNT}, pages.json 子包数: ${SUBPKG_COUNT}"

# ============================================================
# 9. 资质门禁检查
# ============================================================
section "9. 资质门禁检查"

if [[ -n "$ENV_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
    if grep -qi 'MUYING_QUALIFICATION_MODE\s*=\s*phase_two\|MUYING_QUALIFICATION_MODE\s*=\s*strict' "$ENV_FILE" 2>/dev/null; then
        warn "资质门禁模式为严格模式，一期应使用宽松模式（phase_one/loose）"
    else
        pass "资质门禁处于一期模式"
    fi
else
    warn ".env 不可用，无法检查资质门禁模式"
fi

# ============================================================
# 10. 安装入口文件检查
# ============================================================
section "10. 安装入口文件检查"

PUBLIC_INSTALL="${REPO_PATH}/shopxo-backend/public/install.php"
if [[ -f "$PUBLIC_INSTALL" ]]; then
    blocker "发现 public/install.php 文件！生产环境必须删除安装入口，执行: rm -f shopxo-backend/public/install.php"
else
    pass "public/install.php 不存在（已按部署要求删除）"
fi

INSTALL_LOCK="${REPO_PATH}/shopxo-backend/install.lock"
if [[ -f "$INSTALL_LOCK" ]]; then
    pass "install.lock 存在，安装器已锁定（正常状态）"
else
    warn "install.lock 不存在，安装器未锁定。首次部署后会自动生成，无需手动创建。请确认 shopxo-backend/public/install.php 已删除"
fi

# ============================================================
# 汇总
# ============================================================
section "检查汇总"

TOTAL=$((PASS_COUNT + WARN_COUNT + BLOCK_COUNT))
echo -e "  ${C_PASS}PASS: ${PASS_COUNT}${C_RESET}  ${C_WARN}WARN: ${WARN_COUNT}${C_RESET}  ${C_BLOCK}BLOCKER: ${BLOCK_COUNT}${C_RESET}  总计: ${TOTAL}"
echo ""

if [[ ${#BLOCKER_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_BLOCK}存在 ${BLOCK_COUNT} 个 BLOCKER → 关键配置不安全，不可上线${C_RESET}"
    echo ""
    for item in "${BLOCKER_ITEMS[@]}"; do
        echo -e "${C_BLOCK}  ✗ ${item}${C_RESET}"
    done
    echo ""
    echo "修复后重新运行:"
    echo "  bash scripts/preflight/preflight-production-check.sh --env /path/to/.env"
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ ${#WARN_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_WARN}存在 ${WARN_COUNT} 个 WARN → 可上线但建议修复${C_RESET}"
    echo ""
    for item in "${WARN_ITEMS[@]}"; do
        echo -e "${C_WARN}  ⚠ ${item}${C_RESET}"
    done
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}全部通过 → 生产环境配置安全${C_RESET}"
    echo ""
    echo "退出码: 0"
    exit 0
fi
