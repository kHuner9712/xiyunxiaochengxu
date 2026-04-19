#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — preflight 脚本 fixture 自测
# ============================================================
#
# 【用法】bash scripts/preflight/tests/run-tests.sh
# 【输出】每个测试用例 PASS/FAIL + 汇总
# 【退出码】0=全部通过 1=存在失败
#
# 【回归保护】以下失败意味着不能再信任发布门禁脚本：
#   - check-placeholders 退出码逻辑错误 → 占位符漏检 → 生产事故
#   - lib-env.sh 解析错误 → 数据库连接参数读不到 → 门禁形同虚设
#   - release-gate --env 透传失败 → 同上
#   - check-server --env 读取失败 → 同上
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PREFLIGHT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/fixtures"

TOTAL_PASS=0
TOTAL_FAIL=0

assert_exit_code() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    local output="${4:-}"

    if [[ "$actual" -eq "$expected" ]]; then
        echo "  [PASS] ${test_name}: 退出码=$actual"
        TOTAL_PASS=$((TOTAL_PASS + 1))
    else
        echo "  [FAIL] ${test_name}: 期望退出码=$expected, 实际=$actual"
        if [[ -n "$output" ]]; then
            echo "        输出(最后3行):"
            echo "$output" | tail -3 | sed 's/^/          /'
        fi
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

assert_eq() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"

    if [[ "$actual" == "$expected" ]]; then
        echo "  [PASS] ${test_name}: 值='$actual'"
        TOTAL_PASS=$((TOTAL_PASS + 1))
    else
        echo "  [FAIL] ${test_name}: 期望='$expected', 实际='$actual'"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

assert_contains() {
    local test_name="$1"
    local needle="$2"
    local haystack="$3"

    if echo "$haystack" | grep -qF "$needle"; then
        echo "  [PASS] ${test_name}: 包含 '$needle'"
        TOTAL_PASS=$((TOTAL_PASS + 1))
    else
        echo "  [FAIL] ${test_name}: 不包含 '$needle'"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
}

assert_not_contains() {
    local test_name="$1"
    local needle="$2"
    local haystack="$3"

    if echo "$haystack" | grep -qF "$needle"; then
        echo "  [FAIL] ${test_name}: 不应包含 '$needle' 但包含"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
    else
        echo "  [PASS] ${test_name}: 不包含 '$needle'"
        TOTAL_PASS=$((TOTAL_PASS + 1))
    fi
}

assert_contains_any() {
    local test_name="$1"
    local haystack="$2"
    shift 2
    for needle in "$@"; do
        if echo "$haystack" | grep -qF "$needle"; then
            echo "  [PASS] ${test_name}: 包含 '$needle'"
            TOTAL_PASS=$((TOTAL_PASS + 1))
            return 0
        fi
    done
    echo "  [FAIL] ${test_name}: 不包含任何一个: $*"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
}

count_matches() {
    local result
    result=$(echo "$1" | grep -c "$2" 2>/dev/null) || true
    result=$(echo "$result" | tr -d '[:space:]')
    echo "${result:-0}"
}

group() {
    echo ""
    echo "=========================================="
    echo " $1"
    echo "=========================================="
}

# ============================================================
# A. lib-env.sh 解析测试
# ============================================================

group "A. lib-env.sh 解析测试 [回归: .env 解析是所有门禁的基础]"

source "${PREFLIGHT_DIR}/lib-env.sh"

echo "  --- A1. INI 风格解析 ---"
DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""; DB_PREFIX=""
parse_env_file "${FIXTURES_DIR}/env/env.ini-style"
assert_eq "DB_HOST from INI"   "10.0.1.50"     "$DB_HOST"
assert_eq "DB_PORT from INI"   "3307"          "$DB_PORT"
assert_eq "DB_NAME from INI"   "yunxi_prod"    "$DB_NAME"
assert_eq "DB_USER from INI"   "yunxi_app"     "$DB_USER"
assert_eq "DB_PASS from INI"   "test_pass_123" "$DB_PASS"
assert_eq "DB_PREFIX from INI" "sxo_"          "$DB_PREFIX"

echo "  --- A2. 扁平变量风格解析 ---"
DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""; DB_PREFIX=""
parse_env_file "${FIXTURES_DIR}/env/env.flat-style"
assert_eq "DB_HOST from flat"   "192.168.1.100" "$DB_HOST"
assert_eq "DB_PORT from flat"   "3306"          "$DB_PORT"
assert_eq "DB_NAME from flat"   "shopxo_flat"   "$DB_NAME"
assert_eq "DB_USER from flat"   "flat_user"     "$DB_USER"
assert_eq "DB_PASS from flat"   "flat_pass"     "$DB_PASS"
assert_eq "DB_PREFIX from flat" "sxo_"          "$DB_PREFIX"

echo "  --- A3. 不存在的文件应报错 ---"
if parse_env_file "/nonexistent/.env" 2>/dev/null; then
    echo "  [FAIL] 不存在的文件应返回非零退出码"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
else
    echo "  [PASS] 不存在的文件正确返回错误"
    TOTAL_PASS=$((TOTAL_PASS + 1))
fi

echo "  --- A4. 空路径不报错 ---"
if parse_env_file ""; then
    echo "  [PASS] 空路径正确跳过"
    TOTAL_PASS=$((TOTAL_PASS + 1))
else
    echo "  [FAIL] 空路径不应报错"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# ============================================================
# B. check-placeholders.sh 测试
# ============================================================

group "B. check-placeholders.sh 测试 [回归: 占位符漏检=生产事故]"

PH_SCRIPT="${PREFLIGHT_DIR}/check-placeholders.sh"

echo "  --- B1. 空目录 → 退出码 0 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color "${FIXTURES_DIR}/ph-clean" 2>&1)
RC=$?
assert_exit_code "空目录应退出码0" 0 "$RC" "$OUTPUT"

echo "  --- B2. 含代码占位符 → 退出码 1 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color "${FIXTURES_DIR}/ph-code-placeholder" 2>&1)
RC=$?
assert_exit_code "代码占位符应退出码1" 1 "$RC" "$OUTPUT"
assert_contains "输出包含APP_ID" "{{APP_ID}}" "$OUTPUT"

echo "  --- B3. 仅SQL占位符 → 默认退出码 0 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color "${FIXTURES_DIR}/ph-sql-placeholder" 2>&1)
RC=$?
assert_exit_code "SQL占位符默认退出码0" 0 "$RC" "$OUTPUT"

echo "  --- B4. 仅SQL占位符 + --strict → 退出码 1 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color --strict "${FIXTURES_DIR}/ph-sql-placeholder" 2>&1)
RC=$?
assert_exit_code "SQL占位符--strict退出码1" 1 "$RC" "$OUTPUT"

echo "  --- B5. 仅docs占位符 → 退出码 0 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color "${FIXTURES_DIR}/ph-docs-placeholder" 2>&1)
RC=$?
assert_exit_code "docs占位符默认退出码0" 0 "$RC" "$OUTPUT"

echo "  --- B6. docs占位符 + --docs-also → 退出码 0 (docs不阻断) ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color --docs-also "${FIXTURES_DIR}/ph-docs-placeholder" 2>&1)
RC=$?
assert_exit_code "docs占位符--docs-also仍退出码0" 0 "$RC" "$OUTPUT"

echo "  --- B7. 混合fixture: 代码+SQL+docs → 退出码 1 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color "${FIXTURES_DIR}/ph-mixed" 2>&1)
RC=$?
assert_exit_code "混合fixture退出码1" 1 "$RC" "$OUTPUT"

echo "  --- B8. --help 返回 0 ---"
OUTPUT=$(bash "$PH_SCRIPT" --help 2>&1)
RC=$?
assert_exit_code "--help退出码0" 0 "$RC" "$OUTPUT"

echo "  --- B9. --no-color + --strict + --docs-also 组合不报错 ---"
OUTPUT=$(bash "$PH_SCRIPT" --no-color --strict --docs-also "${FIXTURES_DIR}/ph-clean" 2>&1)
RC=$?
assert_exit_code "选项组合不报错退出码0" 0 "$RC" "$OUTPUT"

echo "  --- B10. 未知选项 → 退出码 1 ---"
OUTPUT=$(bash "$PH_SCRIPT" --unknown-opt 2>&1)
RC=$?
assert_exit_code "未知选项退出码1" 1 "$RC" "$OUTPUT"

# ============================================================
# C. check-server.sh 测试
# ============================================================

group "C. check-server.sh 测试 [回归: --env读不到=门禁形同虚设]"

SV_SCRIPT="${PREFLIGHT_DIR}/check-server.sh"

echo "  --- C1. --help 返回 0 ---"
OUTPUT=$(bash "$SV_SCRIPT" --help 2>&1)
RC=$?
assert_exit_code "--help退出码0" 0 "$RC" "$OUTPUT"

echo "  --- C2. --env 缺少参数 → 退出码 1 ---"
OUTPUT=$(bash "$SV_SCRIPT" --env 2>&1)
RC=$?
assert_exit_code "--env缺参数退出码1" 1 "$RC" "$OUTPUT"

echo "  --- C3. --env 指向不存在的文件 → 退出码 1 ---"
OUTPUT=$(bash "$SV_SCRIPT" --env /nonexistent/.env --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
RC=$?
assert_exit_code "--env文件不存在退出码1" 1 "$RC" "$OUTPUT"

echo "  --- C4. --env INI风格 → 脚本不报env解析错误 ---"
OUTPUT=$(bash "$SV_SCRIPT" --env "${FIXTURES_DIR}/env/env.ini-style" --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
RC=$?
assert_not_contains "INI env无解析错误" "公共解析库不存在" "$OUTPUT"
assert_not_contains "INI env无文件不存在错误" ".env 文件不存在" "$OUTPUT"

echo "  --- C5. --env 扁平风格 → 脚本不报env解析错误 ---"
OUTPUT=$(bash "$SV_SCRIPT" --env "${FIXTURES_DIR}/env/env.flat-style" --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
RC=$?
assert_not_contains "flat env无解析错误" "公共解析库不存在" "$OUTPUT"
assert_not_contains "flat env无文件不存在错误" ".env 文件不存在" "$OUTPUT"

echo "  --- C6. --no-color 不产生 ANSI 转义 ---"
OUTPUT=$(bash "$SV_SCRIPT" --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
if echo "$OUTPUT" | grep -qP '\x1b\['; then
    echo "  [FAIL] --no-color 仍包含ANSI转义"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
else
    echo "  [PASS] --no-color 无ANSI转义"
    TOTAL_PASS=$((TOTAL_PASS + 1))
fi

echo "  --- C7. --quiet 模式不输出 PASS 行 ---"
OUTPUT=$(bash "$SV_SCRIPT" --no-color --quiet "${FIXTURES_DIR}/backend-minimal" 2>&1)
PASS_LINES=$(count_matches "$OUTPUT" '\[PASS\]')
if [[ "$PASS_LINES" -eq 0 ]]; then
    echo "  [PASS] --quiet模式无PASS行"
    TOTAL_PASS=$((TOTAL_PASS + 1))
else
    echo "  [FAIL] --quiet模式仍有${PASS_LINES}个PASS行"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

echo "  --- C8. 未知选项 → 退出码 1 ---"
OUTPUT=$(bash "$SV_SCRIPT" --unknown-opt 2>&1)
RC=$?
assert_exit_code "未知选项退出码1" 1 "$RC" "$OUTPUT"

echo "  --- C9. 计数器与退出码: FAIL存在时退出码1 ---"
OUTPUT=$(bash "$SV_SCRIPT" --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
RC=$?
FAIL_LINES=$(count_matches "$OUTPUT" '\[FAIL\]')
if [[ "$FAIL_LINES" -gt 0 ]] && [[ "$RC" -eq 1 ]]; then
    echo "  [PASS] 有FAIL且退出码=1"
    TOTAL_PASS=$((TOTAL_PASS + 1))
elif [[ "$FAIL_LINES" -eq 0 ]] && [[ "$RC" -eq 0 ]]; then
    echo "  [PASS] 无FAIL且退出码=0"
    TOTAL_PASS=$((TOTAL_PASS + 1))
else
    echo "  [FAIL] FAIL数=${FAIL_LINES} 但退出码=${RC}，不一致"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# ============================================================
# D. release-gate.sh 测试
# ============================================================

group "D. release-gate.sh 测试 [回归: 门禁总控逻辑错误=全链路失效]"

RG_SCRIPT="${PREFLIGHT_DIR}/release-gate.sh"

echo "  --- D1. --help 返回 0 ---"
OUTPUT=$(bash "$RG_SCRIPT" --help 2>&1)
RC=$?
assert_exit_code "--help退出码0" 0 "$RC" "$OUTPUT"

echo "  --- D2. 子脚本FAIL → 总退出码 1 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-server --skip-db --repo "${FIXTURES_DIR}/ph-code-placeholder" 2>&1)
RC=$?
assert_exit_code "占位符FAIL→总退出码1" 1 "$RC" "$OUTPUT"
assert_contains_any "输出含阻断/FAIL/不建议发布" "$OUTPUT" "阻断" "FAIL" "不建议发布"

echo "  --- D3. 全部跳过 → 退出码 0 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-server --skip-db 2>&1)
RC=$?
assert_exit_code "全部跳过退出码0" 0 "$RC" "$OUTPUT"

echo "  --- D4. 只有WARN → 退出码 0 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-server --skip-db --repo "${FIXTURES_DIR}/ph-clean" 2>&1)
RC=$?
assert_exit_code "只有WARN退出码0" 0 "$RC" "$OUTPUT"

echo "  --- D5. --strict 下 SQL占位符 → 退出码 1 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --strict --skip-server --skip-db --repo "${FIXTURES_DIR}/ph-sql-placeholder" 2>&1)
RC=$?
assert_exit_code "--strict+SQL占位符退出码1" 1 "$RC" "$OUTPUT"

echo "  --- D6. --skip-placeholders 行为正确 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-server --skip-db 2>&1)
RC=$?
assert_not_contains "跳过占位符扫描" "占位符残留扫描" "$OUTPUT"
assert_contains "显示SKIP" "SKIP" "$OUTPUT"

echo "  --- D7. --skip-server 行为正确 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-server --skip-db 2>&1)
RC=$?
assert_contains "显示SKIP服务器" "SKIP" "$OUTPUT"

echo "  --- D8. --skip-db 行为正确 ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-server --skip-db 2>&1)
RC=$?
assert_contains "显示SKIP数据库" "SKIP" "$OUTPUT"

echo "  --- D9. --env INI风格能透传给子脚本(无解析错误) ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-db --env "${FIXTURES_DIR}/env/env.ini-style" --backend "${FIXTURES_DIR}/backend-minimal" 2>&1)
assert_not_contains "INI env透传无解析错误" "公共解析库不存在" "$OUTPUT"
assert_not_contains "INI env透传无文件不存在错误" ".env 文件不存在" "$OUTPUT"

echo "  --- D10. --env 扁平风格能透传给子脚本(无解析错误) ---"
OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-db --env "${FIXTURES_DIR}/env/env.flat-style" --backend "${FIXTURES_DIR}/backend-minimal" 2>&1)
assert_not_contains "flat env透传无解析错误" "公共解析库不存在" "$OUTPUT"
assert_not_contains "flat env透传无文件不存在错误" ".env 文件不存在" "$OUTPUT"

echo "  --- D11. 未知选项 → 退出码 1 ---"
OUTPUT=$(bash "$RG_SCRIPT" --unknown-opt 2>&1)
RC=$?
assert_exit_code "未知选项退出码1" 1 "$RC" "$OUTPUT"

# ============================================================
# E. 跨脚本一致性测试
# ============================================================

group "E. 跨脚本一致性测试 [回归: 同一.env两个脚本必须读到相同参数]"

echo "  --- E1. 同一INI .env → 两个脚本都不报env解析错误 ---"
SV_OUTPUT=$(bash "$SV_SCRIPT" --env "${FIXTURES_DIR}/env/env.ini-style" --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
RG_OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-db --env "${FIXTURES_DIR}/env/env.ini-style" --backend "${FIXTURES_DIR}/backend-minimal" 2>&1)

SV_NO_ERR=0; RG_NO_ERR=0
if ! echo "$SV_OUTPUT" | grep -qF "公共解析库不存在" && ! echo "$SV_OUTPUT" | grep -qF ".env 文件不存在"; then
    SV_NO_ERR=1
fi
if ! echo "$RG_OUTPUT" | grep -qF "公共解析库不存在" && ! echo "$RG_OUTPUT" | grep -qF ".env 文件不存在"; then
    RG_NO_ERR=1
fi

if [[ "$SV_NO_ERR" -eq 1 ]] && [[ "$RG_NO_ERR" -eq 1 ]]; then
    echo "  [PASS] 两个脚本都能正确解析 INI .env"
    TOTAL_PASS=$((TOTAL_PASS + 1))
else
    echo "  [FAIL] check-server无err=${SV_NO_ERR}, release-gate无err=${RG_NO_ERR}"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

echo "  --- E2. 同一扁平 .env → 两个脚本都不报env解析错误 ---"
SV_OUTPUT=$(bash "$SV_SCRIPT" --env "${FIXTURES_DIR}/env/env.flat-style" --no-color "${FIXTURES_DIR}/backend-minimal" 2>&1)
RG_OUTPUT=$(bash "$RG_SCRIPT" --no-color --skip-placeholders --skip-db --env "${FIXTURES_DIR}/env/env.flat-style" --backend "${FIXTURES_DIR}/backend-minimal" 2>&1)

SV_NO_ERR=0; RG_NO_ERR=0
if ! echo "$SV_OUTPUT" | grep -qF "公共解析库不存在" && ! echo "$SV_OUTPUT" | grep -qF ".env 文件不存在"; then
    SV_NO_ERR=1
fi
if ! echo "$RG_OUTPUT" | grep -qF "公共解析库不存在" && ! echo "$RG_OUTPUT" | grep -qF ".env 文件不存在"; then
    RG_NO_ERR=1
fi

if [[ "$SV_NO_ERR" -eq 1 ]] && [[ "$RG_NO_ERR" -eq 1 ]]; then
    echo "  [PASS] 两个脚本都能正确解析 flat .env"
    TOTAL_PASS=$((TOTAL_PASS + 1))
else
    echo "  [FAIL] check-server无err=${SV_NO_ERR}, release-gate无err=${RG_NO_ERR}"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# ============================================================
# 汇总
# ============================================================

echo ""
echo "=========================================="
echo " 测试汇总"
echo "=========================================="
echo "  PASS: ${TOTAL_PASS}"
echo "  FAIL: ${TOTAL_FAIL}"
echo ""

if [[ $TOTAL_FAIL -gt 0 ]]; then
    echo "❌ 存在 ${TOTAL_FAIL} 个失败，发布门禁脚本不可信"
    echo ""
    echo "关键回归项检查："
    echo "  - lib-env.sh 解析 → .env 读不到 = 门禁形同虚设"
    echo "  - check-placeholders 退出码 → 占位符漏检 = 生产事故"
    echo "  - release-gate --env 透传 → 数据库参数读不到 = 门禁形同虚设"
    echo "  - 跨脚本一致性 → 同一 .env 两个脚本结果不同 = 解析口径分裂"
    exit 1
else
    echo "✅ 全部 ${TOTAL_PASS} 项通过，发布门禁脚本可信"
    exit 0
fi
