#!/usr/bin/env bash
# ============================================================
# lib-env.sh 解析自验证
# ============================================================
# 用法: bash test-env-parse.sh
# 预期: 全部 PASS，退出码 0
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_ENV="${SCRIPT_DIR}/../lib-env.sh"

if [[ ! -f "$LIB_ENV" ]]; then
    echo "错误: lib-env.sh 不存在于 $LIB_ENV" >&2
    exit 1
fi

source "$LIB_ENV"

PASS=0
FAIL=0

assert_eq() {
    local name="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then
        echo "[PASS] $name = '$actual'"
        PASS=$((PASS + 1))
    else
        echo "[FAIL] $name: 期望='$expected', 实际='$actual'"
        FAIL=$((FAIL + 1))
    fi
}

echo "=========================================="
echo " 测试1: ThinkPHP/INI 风格 .env 解析"
echo "=========================================="

DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""; DB_PREFIX=""
parse_env_file "${SCRIPT_DIR}/.env.fixture"

assert_eq "DB_HOST"   "10.0.1.50"    "$DB_HOST"
assert_eq "DB_PORT"   "3307"         "$DB_PORT"
assert_eq "DB_NAME"   "yunxi_prod"   "$DB_NAME"
assert_eq "DB_USER"   "yunxi_app"    "$DB_USER"
assert_eq "DB_PASS"   "test_pass_123" "$DB_PASS"
assert_eq "DB_PREFIX" "sxo_"         "$DB_PREFIX"

echo ""
echo "=========================================="
echo " 测试2: 扁平变量风格 .env 解析"
echo "=========================================="

FIXTURE_FLAT=$(mktemp)
cat > "$FIXTURE_FLAT" <<'EOF'
DB_HOST=192.168.1.100
DB_PORT=3306
DB_NAME=shopxo_flat
DB_USER=flat_user
DB_PASS=flat_pass
DB_PREFIX=sxo_
EOF

DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""; DB_PREFIX=""
parse_env_file "$FIXTURE_FLAT"

assert_eq "DB_HOST"   "192.168.1.100" "$DB_HOST"
assert_eq "DB_PORT"   "3306"          "$DB_PORT"
assert_eq "DB_NAME"   "shopxo_flat"   "$DB_NAME"
assert_eq "DB_USER"   "flat_user"     "$DB_USER"
assert_eq "DB_PASS"   "flat_pass"     "$DB_PASS"
assert_eq "DB_PREFIX" "sxo_"          "$DB_PREFIX"

rm -f "$FIXTURE_FLAT"

echo ""
echo "=========================================="
echo " 测试3: INI + 扁平混合（扁平覆盖 INI）"
echo "=========================================="

FIXTURE_MIX=$(mktemp)
cat > "$FIXTURE_MIX" <<'EOF'
[DATABASE]
HOSTNAME = ini_host
DATABASE = ini_db
USERNAME = ini_user
PASSWORD = ini_pass
HOSTPORT = 3307
PREFIX = ini_

DB_HOST=flat_host
DB_NAME=flat_db
EOF

DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""; DB_PREFIX=""
parse_env_file "$FIXTURE_MIX"

assert_eq "DB_HOST"   "flat_host" "$DB_HOST"
assert_eq "DB_PORT"   "3307"      "$DB_PORT"
assert_eq "DB_NAME"   "flat_db"   "$DB_NAME"
assert_eq "DB_USER"   "ini_user"  "$DB_USER"
assert_eq "DB_PASS"   "ini_pass"  "$DB_PASS"
assert_eq "DB_PREFIX" "ini_"      "$DB_PREFIX"

rm -f "$FIXTURE_MIX"

echo ""
echo "=========================================="
echo " 测试4: 不存在的文件应报错"
echo "=========================================="

if parse_env_file "/nonexistent/.env" 2>/dev/null; then
    echo "[FAIL] 不存在的文件应返回非零退出码"
    FAIL=$((FAIL + 1))
else
    echo "[PASS] 不存在的文件正确返回错误"
    PASS=$((PASS + 1))
fi

echo ""
echo "=========================================="
echo " 测试5: 空路径不报错"
echo "=========================================="

if parse_env_file ""; then
    echo "[PASS] 空路径正确跳过"
    PASS=$((PASS + 1))
else
    echo "[FAIL] 空路径不应报错"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "=========================================="
echo " 测试6: 带引号和注释的值"
echo "=========================================="

FIXTURE_QUOTE=$(mktemp)
cat > "$FIXTURE_QUOTE" <<'EOF'
# 这是注释
[DATABASE]
HOSTNAME = "10.0.2.50"
DATABASE = 'quoted_db'
USERNAME = quoted_user
PASSWORD = "p@ss'word"
HOSTPORT = 3306
PREFIX = sxo_
EOF

DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""; DB_PREFIX=""
parse_env_file "$FIXTURE_QUOTE"

assert_eq "DB_HOST"   "10.0.2.50"   "$DB_HOST"
assert_eq "DB_NAME"   "quoted_db"   "$DB_NAME"
assert_eq "DB_USER"   "quoted_user" "$DB_USER"
assert_eq "DB_PASS"   "p@ss'word"   "$DB_PASS"
assert_eq "DB_PREFIX" "sxo_"        "$DB_PREFIX"

rm -f "$FIXTURE_QUOTE"

echo ""
echo "=========================================="
echo " 汇总"
echo "=========================================="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo "存在 $FAIL 个 FAIL，自验证未通过"
    exit 1
else
    echo "全部通过，lib-env.sh 解析逻辑正确"
    exit 0
fi
