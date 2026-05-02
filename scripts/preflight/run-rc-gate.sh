#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — RC 门禁一键检查
# ============================================================
#
# 【用途】一键执行所有发布前检查脚本，输出最终发布结论
# 【用法】bash run-rc-gate.sh [选项]
# 【选项】
#   --repo PATH          仓库根目录（默认 .）
#   --env FILE           后端 .env 文件路径
#   --api URL            后端 API 基础 URL（可选）
#   --mode=experience    体验版模式（默认）
#   --mode=submit        提审模式
#   --no-color           关闭彩色输出
#   --skip-placeholders  跳过占位符检查
#   --skip-runtime       跳过运行时配置检查
#   --skip-admin         跳过后台管理检查
#   --skip-wechat        跳过微信提审检查
#   --skip-legacy        跳过旧版脚本（release-gate）
#   --help               显示帮助
#
# 【输出等级】PASS / WARN / BLOCKER
# 【退出码】0=可发布，1=存在 BLOCKER
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

REPO_PATH="."
ENV_FILE=""
API_URL=""
MODE="experience"
NO_COLOR=0
SKIP_PLACEHOLDERS=0
SKIP_RUNTIME=0
SKIP_ADMIN=0
SKIP_WECHAT=0
SKIP_LEGACY=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)             REPO_PATH="$2"; shift 2 ;;
        --env)              ENV_FILE="$2"; shift 2 ;;
        --api)              API_URL="$2"; shift 2 ;;
        --mode=*)           MODE="${1#*=}"; shift ;;
        --no-color)         NO_COLOR=1; shift ;;
        --skip-placeholders) SKIP_PLACEHOLDERS=1; shift ;;
        --skip-runtime)     SKIP_RUNTIME=1; shift ;;
        --skip-admin)       SKIP_ADMIN=1; shift ;;
        --skip-wechat)      SKIP_WECHAT=1; shift ;;
        --skip-legacy)      SKIP_LEGACY=1; shift ;;
        --help|-h)          head -28 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        -*)                 echo "未知选项: $1" >&2; exit 1 ;;
        *)                  REPO_PATH="$1"; shift ;;
    esac
done

if [[ $NO_COLOR -eq 1 ]] || [[ ! -t 1 ]]; then
    C_PASS=""; C_WARN=""; C_BLOCK=""; C_INFO=""; C_BOLD=""; C_RESET=""
else
    C_PASS="\033[32m"; C_WARN="\033[33m"; C_BLOCK="\033[31m"
    C_INFO="\033[36m"; C_BOLD="\033[1m"; C_RESET="\033[0m"
fi

TOTAL_BLOCK=0
TOTAL_WARN=0
TOTAL_PASS=0
BLOCKER_ITEMS=()
WARN_ITEMS=()

SEPARATOR="═══════════════════════════════════════════════════════════════"

echo ""
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo -e "${C_BOLD}  禧孕小程序 — RC 门禁一键检查${C_RESET}"
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo ""
echo "  仓库路径:   ${REPO_PATH}"
echo "  检查模式:   ${MODE}"
echo "  .env 文件:  ${ENV_FILE:-未指定}"
echo "  API URL:    ${API_URL:-未指定}"
echo ""

START_TIME=$(date +%s)

run_script() {
    local name="$1"
    local script="$2"
    shift 2

    echo ""
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo -e "${C_BOLD}  ${name}${C_RESET}"
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo ""

    if [[ ! -f "$script" ]]; then
        echo -e "${C_BLOCK}[BLOCKER] 脚本不存在: ${script}${C_RESET}"
        TOTAL_BLOCK=$((TOTAL_BLOCK + 1))
        BLOCKER_ITEMS+=("${name}: 脚本文件缺失")
        return
    fi

    OUTPUT=$(bash "$script" "$@" 2>&1)
    EXIT_CODE=$?

    echo "$OUTPUT"
    echo ""

    BLOCKS=$(echo "$OUTPUT" | grep -c '\[BLOCKER\]' 2>/dev/null || echo "0")
    WARNS=$(echo "$OUTPUT" | grep -c '\[WARN\]' 2>/dev/null || echo "0")
    PASSES=$(echo "$OUTPUT" | grep -c '\[PASS\]' 2>/dev/null || echo "0")

    TOTAL_BLOCK=$((TOTAL_BLOCK + BLOCKS))
    TOTAL_WARN=$((TOTAL_WARN + WARNS))
    TOTAL_PASS=$((TOTAL_PASS + PASSES))

    if [[ $BLOCKS -gt 0 ]]; then
        BLOCKER_ITEMS+=("${name}: ${BLOCKS} 个 BLOCKER")
        echo -e "${C_BLOCK}  → ${name}: ${BLOCKS} BLOCKER, ${WARNS} WARN, ${PASSES} PASS${C_RESET}"
    elif [[ $WARNS -gt 0 ]]; then
        WARN_ITEMS+=("${name}: ${WARNS} 个 WARN")
        echo -e "${C_WARN}  → ${name}: ${WARNS} WARN, ${PASSES} PASS${C_RESET}"
    else
        echo -e "${C_PASS}  → ${name}: 全部 PASS${C_RESET}"
    fi
}

# ============================================================
# A. 发布占位符检查
# ============================================================

if [[ $SKIP_PLACEHOLDERS -eq 0 ]]; then
    PH_ARGS=("$REPO_PATH" "--mode=${MODE}")
    [[ $NO_COLOR -eq 1 ]] && PH_ARGS+=("--no-color")
    run_script "A. 发布占位符与配置值检查" "${SCRIPT_DIR}/check-release-placeholders.sh" "${PH_ARGS[@]}"
else
    echo -e "${C_INFO}  [SKIP] 发布占位符检查已跳过${C_RESET}"
fi

# ============================================================
# B. 运行时配置检查
# ============================================================

if [[ $SKIP_RUNTIME -eq 0 ]]; then
    if [[ -n "$ENV_FILE" ]]; then
        RT_ARGS=("--env=${ENV_FILE}")
        [[ -n "$API_URL" ]] && RT_ARGS+=("--api=${API_URL}")
        [[ $NO_COLOR -eq 1 ]] && RT_ARGS+=("--no-color")
        run_script "B. 运行时配置完整性检查" "${SCRIPT_DIR}/check-runtime-config.sh" "${RT_ARGS[@]}"
    else
        echo ""
        echo -e "${C_WARN}  [SKIP] 运行时配置检查已跳过（未指定 --env）${C_RESET}"
        echo -e "${C_WARN}  提示: 使用 --env /path/to/.env 启用此检查${C_RESET}"
        TOTAL_WARN=$((TOTAL_WARN + 1))
        WARN_ITEMS+=("运行时配置检查: 未指定 --env，已跳过")
    fi
else
    echo -e "${C_INFO}  [SKIP] 运行时配置检查已跳过${C_RESET}"
fi

# ============================================================
# C. 后台管理初始化检查
# ============================================================

if [[ $SKIP_ADMIN -eq 0 ]]; then
    AD_ARGS=("$REPO_PATH")
    [[ $NO_COLOR -eq 1 ]] && AD_ARGS+=("--no-color")
    run_script "C. 后台管理初始化检查" "${SCRIPT_DIR}/check-admin-bootstrap.sh" "${AD_ARGS[@]}"
else
    echo -e "${C_INFO}  [SKIP] 后台管理检查已跳过${C_RESET}"
fi

# ============================================================
# D. 微信提审就绪检查（仅提审模式）
# ============================================================

if [[ $SKIP_WECHAT -eq 0 ]]; then
    WX_ARGS=("$REPO_PATH")
    [[ $NO_COLOR -eq 1 ]] && WX_ARGS+=("--no-color")
    run_script "D. 微信提审就绪检查" "${SCRIPT_DIR}/check-wechat-submit-readiness.sh" "${WX_ARGS[@]}"
else
    echo -e "${C_INFO}  [SKIP] 微信提审检查已跳过${C_RESET}"
fi

# ============================================================
# E. 旧版发布门禁（可选）
# ============================================================

if [[ $SKIP_LEGACY -eq 0 ]]; then
    if [[ -f "${SCRIPT_DIR}/release-gate.sh" ]]; then
        LG_ARGS=("--repo" "$REPO_PATH" "--backend" "$REPO_PATH/shopxo-backend")
        [[ -n "$ENV_FILE" ]] && LG_ARGS+=("--env" "$ENV_FILE")
        [[ $NO_COLOR -eq 1 ]] && LG_ARGS+=("--no-color")
        run_script "E. 旧版发布门禁（兼容）" "${SCRIPT_DIR}/release-gate.sh" "${LG_ARGS[@]}"
    fi
else
    echo -e "${C_INFO}  [SKIP] 旧版发布门禁已跳过${C_RESET}"
fi

# ============================================================
# 最终结论
# ============================================================

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo -e "${C_BOLD}  RC 门禁 — 最终结论${C_RESET}"
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo ""

echo "  执行耗时:     ${ELAPSED} 秒"
echo "  通过项:       ${TOTAL_PASS}"
echo "  警告项:       ${TOTAL_WARN}"
echo "  阻断项:       ${TOTAL_BLOCK}"
echo "  检查模式:     ${MODE}"
echo ""

if [[ ${#BLOCKER_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_BLOCK}  阻断发布项:${C_RESET}"
    for item in "${BLOCKER_ITEMS[@]}"; do
        echo -e "${C_BLOCK}    ✗ ${item}${C_RESET}"
    done
    echo ""
fi

if [[ ${#WARN_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_WARN}  建议修复项:${C_RESET}"
    for item in "${WARN_ITEMS[@]}"; do
        echo -e "${C_WARN}    ⚠ ${item}${C_RESET}"
    done
    echo ""
fi

if [[ $TOTAL_BLOCK -gt 0 ]]; then
    echo -e "${C_BLOCK}${C_BOLD}  结论: 不可发布 — 存在 ${TOTAL_BLOCK} 个 BLOCKER${C_RESET}"
    echo ""
    echo "  下一步动作:"
    echo "    1. 修复上述 BLOCKER 项"
    echo "    2. 重新运行: bash scripts/preflight/run-rc-gate.sh --mode=${MODE} --env /path/to/.env ."
    echo "    3. 全部通过后再进入发布流程"
    echo ""
    echo "  参考文档:"
    echo "    docs/release/pre-launch-config-checklist.md  — 配置清单"
    echo "    docs/release/experience-version-launch-checklist.md — 体验版上线步骤"
    echo "    docs/release/submission-materials-checklist.md — 提审材料清单"
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ $TOTAL_WARN -gt 0 ]]; then
    echo -e "${C_WARN}${C_BOLD}  结论: 可发布（有 ${TOTAL_WARN} 个 WARN）${C_RESET}"
    echo ""
    echo "  体验版: 可立即上线"
    if [[ "$MODE" == "submit" ]]; then
        echo "  提审: 需确认 WARN 项是否影响审核"
    else
        echo "  提审: 需修复 WARN 项后再执行 --mode=submit 检查"
    fi
    echo ""
    echo "  推荐命令:"
    echo "    bash scripts/preflight/run-rc-gate.sh --mode=submit --env /path/to/.env ."
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}${C_BOLD}  结论: 全部通过 — 可发布${C_RESET}"
    echo ""
    echo "  下一步动作:"
    if [[ "$MODE" == "experience" ]]; then
        echo "    1. 按 docs/release/experience-version-launch-checklist.md 执行体验版上线"
        echo "    2. 上线后运行 smoke test: docs/release/experience-smoke-test.md"
    else
        echo "    1. 按 docs/release/submission-materials-checklist.md 准备提审材料"
        echo "    2. 提交微信审核"
    fi
    echo ""
    echo "退出码: 0"
    exit 0
fi
