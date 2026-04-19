#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — 一键发布门禁
# ============================================================
#
# 【用途】统一执行占位符扫描 + 服务器预检 + 数据库预检，输出发布结论
# 【用法】bash release-gate.sh [选项]
# 【选项】
#   --repo PATH           仓库根目录（默认 .）
#   --backend PATH        后端代码目录（默认 .）
#   --env FILE            从 .env 文件读取数据库连接
#   --strict              严格模式（WARN/SQL占位符也阻断）
#   --no-color            关闭彩色输出
#   --quiet               只输出 FAIL/WARN，不输出 PASS
#   --skip-placeholders   跳过占位符扫描
#   --skip-server         跳过服务器环境预检
#   --skip-db             跳过数据库结构预检
#   --help                显示帮助
#
# 【退出码】
#   0 — 可以进入发布流程（全 PASS 或仅有 WARN）
#   1 — 不建议发布（存在阻断项）
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

REPO_PATH="."
BACKEND_PATH="."
ENV_FILE=""
STRICT=0
NO_COLOR=0
QUIET=0
SKIP_PLACEHOLDERS=0
SKIP_SERVER=0
SKIP_DB=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)            REPO_PATH="$2"; shift 2 ;;
        --backend)         BACKEND_PATH="$2"; shift 2 ;;
        --env)             ENV_FILE="$2"; shift 2 ;;
        --strict)          STRICT=1; shift ;;
        --no-color)        NO_COLOR=1; shift ;;
        --quiet)           QUIET=1; shift ;;
        --skip-placeholders) SKIP_PLACEHOLDERS=1; shift ;;
        --skip-server)     SKIP_SERVER=1; shift ;;
        --skip-db)         SKIP_DB=1; shift ;;
        --help|-h)
            head -20 "$0" | grep '^#' | sed 's/^# \?//'
            echo ""
            echo "示例:"
            echo "  bash release-gate.sh --repo /path/to/repo --backend /path/to/backend"
            echo "  bash release-gate.sh --strict --no-color"
            echo "  bash release-gate.sh --skip-db --env /path/to/.env"
            exit 0
            ;;
        -*)  echo "未知选项: $1" >&2; exit 1 ;;
        *)   echo "未知参数: $1（请使用 --repo 或 --backend 指定路径）" >&2; exit 1 ;;
    esac
done

if [[ $NO_COLOR -eq 1 ]] || [[ ! -t 1 ]]; then
    C_FAIL=""; C_WARN=""; C_PASS=""; C_INFO=""; C_BOLD=""; C_RESET=""
else
    C_FAIL="\033[31m"; C_WARN="\033[33m"; C_PASS="\033[32m"
    C_INFO="\033[36m"; C_BOLD="\033[1m"; C_RESET="\033[0m"
fi

TOTAL_FAIL=0
TOTAL_WARN=0
TOTAL_PASS=0

BLOCKING_ITEMS=()
WARNING_ITEMS=()

SEPARATOR="═══════════════════════════════════════════════════════════════"

echo ""
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo -e "${C_BOLD}  孕禧小程序 — 一键发布门禁${C_RESET}"
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo ""
echo "  仓库路径:   ${REPO_PATH}"
echo "  后端路径:   ${BACKEND_PATH}"
echo "  严格模式:   $([[ $STRICT -eq 1 ]] && echo '是' || echo '否')"
echo "  跳过项:     $([[ $SKIP_PLACEHOLDERS -eq 1 ]] && echo '占位符 ' || echo '')$([[ $SKIP_SERVER -eq 1 ]] && echo '服务器 ' || echo '')$([[ $SKIP_DB -eq 1 ]] && echo '数据库 ' || echo '')$([[ $SKIP_PLACEHOLDERS -eq 0 && $SKIP_SERVER -eq 0 && $SKIP_DB -eq 0 ]] && echo '无')"
echo ""

START_TIME=$(date +%s)

# ============================================================
# A. 占位符扫描
# ============================================================

if [[ $SKIP_PLACEHOLDERS -eq 0 ]]; then
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo -e "${C_BOLD}  A. 占位符残留扫描${C_RESET}"
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo ""

    PH_ARGS=()
    [[ $NO_COLOR -eq 1 ]] && PH_ARGS+=("--no-color")
    [[ $STRICT -eq 1 ]] && PH_ARGS+=("--strict")

    PH_OUTPUT=$(bash "${SCRIPT_DIR}/check-placeholders.sh" "${PH_ARGS[@]}" "$REPO_PATH" 2>&1)
    PH_EXIT=$?

    echo "$PH_OUTPUT"
    echo ""

    if [[ $PH_EXIT -eq 0 ]]; then
        TOTAL_PASS=$((TOTAL_PASS + 1))
        echo -e "${C_PASS}  [PASS] 占位符扫描通过${C_RESET}"
    else
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        BLOCKING_ITEMS+=("占位符扫描: 代码/配置中存在残留占位符或开发默认值")
        echo -e "${C_FAIL}  [FAIL] 占位符扫描未通过${C_RESET}"
    fi
    echo ""
else
    echo -e "${C_INFO}  [SKIP] 占位符扫描已跳过${C_RESET}"
    echo ""
fi

# ============================================================
# B. 服务器环境预检
# ============================================================

if [[ $SKIP_SERVER -eq 0 ]]; then
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo -e "${C_BOLD}  B. 服务器环境预检${C_RESET}"
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo ""

    SV_ARGS=()
    [[ $NO_COLOR -eq 1 ]] && SV_ARGS+=("--no-color")
    [[ $QUIET -eq 1 ]] && SV_ARGS+=("--quiet")
    [[ $STRICT -eq 1 ]] && SV_ARGS+=("--strict")
    [[ -n "$ENV_FILE" ]] && SV_ARGS+=("--env" "$ENV_FILE")

    SV_OUTPUT=$(bash "${SCRIPT_DIR}/check-server.sh" "${SV_ARGS[@]}" "$BACKEND_PATH" 2>&1)
    SV_EXIT=$?

    echo "$SV_OUTPUT"
    echo ""

    if [[ $SV_EXIT -eq 0 ]]; then
        SV_FAILS=$(echo "$SV_OUTPUT" | grep -c '\[FAIL\]' 2>/dev/null || echo "0")
        SV_WARNS=$(echo "$SV_OUTPUT" | grep -c '\[WARN\]' 2>/dev/null || echo "0")
        if [[ $SV_FAILS -gt 0 ]]; then
            TOTAL_FAIL=$((TOTAL_FAIL + 1))
            BLOCKING_ITEMS+=("服务器预检: ${SV_FAILS} 个 FAIL 项")
            echo -e "${C_FAIL}  [FAIL] 服务器预检未通过 (${SV_FAILS} FAIL, ${SV_WARNS} WARN)${C_RESET}"
        elif [[ $SV_WARNS -gt 0 ]]; then
            TOTAL_WARN=$((TOTAL_WARN + 1))
            WARNING_ITEMS+=("服务器预检: ${SV_WARNS} 个 WARN 项（建议修复）")
            if [[ $STRICT -eq 1 ]]; then
                TOTAL_FAIL=$((TOTAL_FAIL + 1))
                BLOCKING_ITEMS+=("服务器预检: --strict 模式下 WARN 视为阻断")
                echo -e "${C_FAIL}  [FAIL] 服务器预检 --strict 模式下 WARN 视为阻断${C_RESET}"
            else
                TOTAL_PASS=$((TOTAL_PASS + 1))
                echo -e "${C_PASS}  [PASS] 服务器预检通过（有 ${SV_WARNS} 个 WARN）${C_RESET}"
            fi
        else
            TOTAL_PASS=$((TOTAL_PASS + 1))
            echo -e "${C_PASS}  [PASS] 服务器预检全部通过${C_RESET}"
        fi
    else
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
        BLOCKING_ITEMS+=("服务器预检: 存在 FAIL 项")
        echo -e "${C_FAIL}  [FAIL] 服务器预检未通过${C_RESET}"
    fi
    echo ""
else
    echo -e "${C_INFO}  [SKIP] 服务器环境预检已跳过${C_RESET}"
    echo ""
fi

# ============================================================
# C. 数据库结构预检（可选）
# ============================================================

if [[ $SKIP_DB -eq 0 ]]; then
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo -e "${C_BOLD}  C. 数据库结构预检${C_RESET}"
    echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
    echo ""

    if [[ -n "$ENV_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
        DB_HOST_VAL=$(grep -i '^DATABASE\.HOSTNAME' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d ' "' || echo "")
        DB_PORT_VAL=$(grep -i '^DATABASE\.HOSTPORT' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d ' "' || echo "3306")
        DB_NAME_VAL=$(grep -i '^DATABASE\.DATABASE' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d ' "' || echo "")
        DB_USER_VAL=$(grep -i '^DATABASE\.USERNAME' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d ' "' || echo "")
        DB_PASS_VAL=$(grep -i '^DATABASE\.PASSWORD' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d ' "' || echo "")
    fi

    DB_HOST_VAL="${DB_HOST_VAL:-${DB_HOST:-127.0.0.1}}"
    DB_PORT_VAL="${DB_PORT_VAL:-${DB_PORT:-3306}}"
    DB_NAME_VAL="${DB_NAME_VAL:-${DB_NAME:-shopxo}}"
    DB_USER_VAL="${DB_USER_VAL:-${DB_USER:-root}}"
    DB_PASS_VAL="${DB_PASS_VAL:-${DB_PASS:-}}"

    if command -v mysql &>/dev/null; then
        DB_SQL="${SCRIPT_DIR}/check-db.sql"
        if [[ -f "$DB_SQL" ]]; then
            DB_OUTPUT=$(mysql -h "$DB_HOST_VAL" -P "$DB_PORT_VAL" -u "$DB_USER_VAL" ${DB_PASS_VAL:+-p"$DB_PASS_VAL"} "$DB_NAME_VAL" < "$DB_SQL" 2>&1)
            DB_EXIT=$?

            echo "$DB_OUTPUT"
            echo ""

            DB_FAILS=$(echo "$DB_OUTPUT" | grep -c 'FAIL' 2>/dev/null || echo "0")
            DB_WARNS=$(echo "$DB_OUTPUT" | grep -c 'WARN' 2>/dev/null || echo "0")

            if [[ $DB_EXIT -ne 0 ]]; then
                TOTAL_FAIL=$((TOTAL_FAIL + 1))
                BLOCKING_ITEMS+=("数据库预检: 连接失败或执行出错")
                echo -e "${C_FAIL}  [FAIL] 数据库预检执行失败（检查连接信息）${C_RESET}"
            elif [[ $DB_FAILS -gt 0 ]]; then
                TOTAL_FAIL=$((TOTAL_FAIL + 1))
                BLOCKING_ITEMS+=("数据库预检: ${DB_FAILS} 个 FAIL 项")
                echo -e "${C_FAIL}  [FAIL] 数据库预检未通过 (${DB_FAILS} FAIL)${C_RESET}"
            elif [[ $DB_WARNS -gt 0 ]]; then
                TOTAL_WARN=$((TOTAL_WARN + 1))
                WARNING_ITEMS+=("数据库预检: ${DB_WARNS} 个 WARN 项")
                if [[ $STRICT -eq 1 ]]; then
                    TOTAL_FAIL=$((TOTAL_FAIL + 1))
                    BLOCKING_ITEMS+=("数据库预检: --strict 模式下 WARN 视为阻断")
                    echo -e "${C_FAIL}  [FAIL] 数据库预检 --strict 模式下 WARN 视为阻断${C_RESET}"
                else
                    TOTAL_PASS=$((TOTAL_PASS + 1))
                    echo -e "${C_PASS}  [PASS] 数据库预检通过（有 ${DB_WARNS} 个 WARN）${C_RESET}"
                fi
            else
                TOTAL_PASS=$((TOTAL_PASS + 1))
                echo -e "${C_PASS}  [PASS] 数据库预检全部通过${C_RESET}"
            fi
        else
            echo -e "${C_WARN}  [WARN] 未找到 check-db.sql，跳过数据库预检${C_RESET}"
            TOTAL_WARN=$((TOTAL_WARN + 1))
            WARNING_ITEMS+=("数据库预检: check-db.sql 文件不存在")
        fi
    else
        echo -e "${C_WARN}  [WARN] mysql 客户端不可用，跳过数据库预检${C_RESET}"
        TOTAL_WARN=$((TOTAL_WARN + 1))
        WARNING_ITEMS+=("数据库预检: mysql 客户端不可用")
    fi
    echo ""
else
    echo -e "${C_INFO}  [SKIP] 数据库结构预检已跳过${C_RESET}"
    echo ""
fi

# ============================================================
# D. 汇总结论
# ============================================================

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo -e "${C_BOLD}  发布门禁 — 最终结论${C_RESET}"
echo -e "${C_BOLD}${SEPARATOR}${C_RESET}"
echo ""

echo "  执行耗时:   ${ELAPSED} 秒"
echo "  通过项:     ${TOTAL_PASS}"
echo "  警告项:     ${TOTAL_WARN}"
echo "  阻断项:     ${TOTAL_FAIL}"
echo ""

if [[ ${#BLOCKING_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_FAIL}  阻断发布项:${C_RESET}"
    for item in "${BLOCKING_ITEMS[@]}"; do
        echo -e "${C_FAIL}    ✗ ${item}${C_RESET}"
    done
    echo ""
fi

if [[ ${#WARNING_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_WARN}  建议修复项:${C_RESET}"
    for item in "${WARNING_ITEMS[@]}"; do
        echo -e "${C_WARN}    ⚠ ${item}${C_RESET}"
    done
    echo ""
fi

if [[ $TOTAL_FAIL -gt 0 ]]; then
    echo -e "${C_FAIL}${C_BOLD}  结论: 不建议发布${C_RESET}"
    echo ""
    echo "  下一步动作:"
    echo "    1. 修复上述阻断项"
    echo "    2. 重新运行 bash scripts/preflight/release-gate.sh"
    echo "    3. 全部通过后再进入发布流程"
    echo ""
    echo "  参考:"
    echo "    docs/release/release-values-template.md  — 参数替换清单"
    echo "    docs/release/go-live-runbook.md          — 上线执行手册"
    echo ""
    echo "退出码: 1"
    exit 1
elif [[ $TOTAL_WARN -gt 0 ]]; then
    echo -e "${C_WARN}${C_BOLD}  结论: 可以发布，但建议修复警告项${C_RESET}"
    echo ""
    echo "  下一步动作:"
    echo "    1. 评估警告项是否影响上线"
    echo "    2. 如确认无影响，可进入发布流程"
    echo "    3. 使用 --strict 模式可将 WARN 视为阻断"
    echo ""
    echo "  推荐命令:"
    echo "    bash scripts/preflight/release-gate.sh --strict --repo . --backend /path/to/backend"
    echo ""
    echo "退出码: 0"
    exit 0
else
    echo -e "${C_PASS}${C_BOLD}  结论: 可以进入发布流程${C_RESET}"
    echo ""
    echo "  下一步动作:"
    echo "    1. 按 go-live-runbook.md 执行发布"
    echo "    2. 发布后 1 小时内运行真机验证"
    echo "    3. 发布后 24 小时检查运营数据"
    echo ""
    echo "  推荐命令:"
    echo "    bash scripts/preflight/release-gate.sh --strict --repo . --backend /path/to/backend"
    echo ""
    echo "退出码: 0"
    exit 0
fi
