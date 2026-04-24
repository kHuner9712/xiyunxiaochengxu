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
# 【检查项】
#   1. APP_DEBUG 是否关闭
#   2. .env 是否存在但未提交到 Git
#   3. 生产 request_url 是否 https
#   4. 高风险 feature flag 是否关闭
#   5. 是否存在测试 AppID
#   6. 是否存在 localhost/127.0.0.1/明文密码等生产风险配置
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
