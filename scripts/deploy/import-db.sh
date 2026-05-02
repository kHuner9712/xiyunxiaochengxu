#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 数据库导入脚本
# ============================================================
#
# 【用途】导入 shopxo.sql 主库到 MySQL
# 【用法】bash import-db.sh [选项]
# 【选项】
#   --site-dir PATH   站点目录（必填）
#   --db-host HOST    数据库主机（默认 127.0.0.1）
#   --db-port PORT    数据库端口（默认 3306）
#   --db-name NAME    数据库名（必填）
#   --db-user USER    数据库用户（必填）
#   --db-pass PASS    数据库密码（必填）
#   --help            显示帮助
#
# 【退出码】0=成功，1=失败
# ============================================================

set -uo pipefail

SITE_DIR=""
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME=""
DB_USER=""
DB_PASS=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --site-dir=*) SITE_DIR="${1#*=}"; shift ;;
        --site-dir)   SITE_DIR="${2:-}"; shift 2 ;;
        --db-host=*)  DB_HOST="${1#*=}"; shift ;;
        --db-port=*)  DB_PORT="${1#*=}"; shift ;;
        --db-name=*)  DB_NAME="${1#*=}"; shift ;;
        --db-user=*)  DB_USER="${1#*=}"; shift ;;
        --db-pass=*)  DB_PASS="${1#*=}"; shift ;;
        --help|-h)    head -20 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *)            shift ;;
    esac
done

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"
step() { echo -e "\n${CYAN}[STEP]${RESET} $1"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $1"; }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; exit 1; }

if [[ -z "$SITE_DIR" ]]; then fail "--site-dir 必填"; fi
if [[ -z "$DB_NAME" ]]; then fail "--db-name 必填"; fi
if [[ -z "$DB_USER" ]]; then fail "--db-user 必填"; fi

MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"
if [[ -n "$DB_PASS" ]]; then
    MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS"
fi

# 检查 mysql 客户端
if ! command -v mysql &>/dev/null; then
    fail "mysql 客户端未安装"
fi

# 检查数据库连接
step "检查数据库连接"
if ! $MYSQL_CMD -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
    fail "数据库连接失败: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi
ok "数据库连接成功"

# 检查是否已有数据
TABLE_COUNT=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME LIKE 'sxo_%';" "$DB_NAME" 2>/dev/null || echo "0")
TABLE_COUNT=${TABLE_COUNT:-0}

if [[ "$TABLE_COUNT" -gt 10 ]]; then
    echo -e "${YELLOW}[WARN] 数据库已有 ${TABLE_COUNT} 张 sxo_ 表，跳过主库导入${RESET}"
    echo -e "${YELLOW}       如需重新导入，请先清空数据库${RESET}"
else
    # 导入主库
    MAIN_SQL="${SITE_DIR}/config/shopxo.sql"
    if [[ -f "$MAIN_SQL" ]]; then
        step "导入 shopxo.sql 主库"
        $MYSQL_CMD "$DB_NAME" < "$MAIN_SQL" || fail "shopxo.sql 导入失败"
        ok "shopxo.sql 导入成功"
    else
        fail "找不到 config/shopxo.sql"
    fi
fi

echo ""
ok "数据库导入完成"
exit 0
