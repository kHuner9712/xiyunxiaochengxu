#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — 上线前服务器环境预检
# ============================================================
#
# 【用途】在部署服务器上执行，自动检查上线所需环境条件
# 【用法】bash check-server.sh [选项] [/path/to/shopxo-backend]
# 【依赖】bash 4+, php CLI, mysql CLI
# 【输出】PASS / WARN / FAIL + 修复建议
#
# 【选项】
#   --no-color   关闭彩色输出（适合重定向日志）
#   --quiet      只输出 FAIL/WARN，不输出 PASS
#   --strict     WARN 也视为阻断上线（退出码 1）
#   --env FILE   从 .env 文件读取数据库连接信息
#   --help       显示帮助
#
# 【环境变量】可通过环境变量覆盖默认值：
#   DB_HOST   — 数据库主机（默认 127.0.0.1）
#   DB_PORT   — 数据库端口（默认 3306）
#   DB_NAME   — 数据库名（默认 shopxo）
#   DB_USER   — 数据库用户（默认 root）
#   DB_PASS   — 数据库密码（默认空）
#   DB_PREFIX — 表前缀（默认 sxo_）
# ============================================================

set -uo pipefail

# --- 默认配置 ---
BACKEND_PATH="."
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-shopxo}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_PREFIX="${DB_PREFIX:-sxo_}"

NO_COLOR=0
QUIET=0
STRICT=0

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# --- 参数解析 ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-color)  NO_COLOR=1; shift ;;
        --quiet)     QUIET=1; shift ;;
        --strict)    STRICT=1; shift ;;
        --env)
            if [[ -z "${2:-}" ]]; then
                echo "错误: --env 需要指定文件路径" >&2; exit 1
            fi
            ENV_FILE="$2"; shift 2
            ;;
        --help|-h)
            head -25 "$0" | grep '^#' | sed 's/^# \?//'
            exit 0
            ;;
        -*)
            echo "未知选项: $1" >&2; exit 1
            ;;
        *)
            BACKEND_PATH="$1"; shift
            ;;
    esac
done

# --- 从 .env 文件读取数据库连接 ---
if [[ -n "${ENV_FILE:-}" ]]; then
    if [[ -f "$ENV_FILE" ]]; then
        while IFS='=' read -r key value; do
            key=$(echo "$key" | tr -d ' ' | tr '[:lower:]' '[:upper:]')
            value=$(echo "$value" | tr -d ' ')
            case "$key" in
                DB_HOST)   DB_HOST="$value" ;;
                DB_PORT)   DB_PORT="$value" ;;
                DB_NAME)   DB_NAME="$value" ;;
                DB_USER)   DB_USER="$value" ;;
                DB_PASS)   DB_PASS="$value" ;;
                DB_PREFIX) DB_PREFIX="$value" ;;
            esac
        done < <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
    else
        echo "错误: .env 文件不存在: $ENV_FILE" >&2; exit 1
    fi
fi

# --- 颜色定义 ---
if [[ $NO_COLOR -eq 1 ]] || [[ ! -t 1 ]]; then
    C_PASS=""; C_WARN=""; C_FAIL=""; C_INFO=""; C_RESET=""
else
    C_PASS="\033[32m"; C_WARN="\033[33m"; C_FAIL="\033[31m"; C_INFO="\033[36m"; C_RESET="\033[0m"
fi

# --- 输出函数 ---
# 注意: 计数器使用 PASS_COUNT=$((PASS_COUNT + 1)) 而非 ((PASS_COUNT++))
# 原因: bash 中 ((0++)) 返回退出码 1，与 set -e 冲突会导致脚本提前退出
# 而 $((...)) 算术展开始终返回退出码 0，不受 set -e 影响

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    [[ $QUIET -eq 1 ]] && return 0
    echo -e "${C_PASS}[PASS]${C_RESET} $1"
}

warn() {
    WARN_COUNT=$((WARN_COUNT + 1))
    echo -e "${C_WARN}[WARN]${C_RESET} $1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo -e "${C_FAIL}[FAIL]${C_RESET} $1"
}

info() {
    echo -e "${C_INFO}[INFO]${C_RESET} $1"
}

section() {
    echo ""
    echo "=========================================="
    echo " $1"
    echo "=========================================="
}

# --- 版本比较函数 ---
# 用法: version_gte "当前版本" "最低版本"
# 示例: version_gte "8.0.2" "8.0.2" → 返回 0 (true)
#       version_gte "8.0.1" "8.0.2" → 返回 1 (false)
# 原理: 将版本号各段补零到 4 位再数值比较，避免 major/minor/patch 拆分判断的漏洞
version_gte() {
    local cur="$1" min="$2"
    local cur_norm min_norm
    cur_norm=$(echo "$cur" | awk -F. '{printf "%04d%04d%04d\n", $1, $2, $3}')
    min_norm=$(echo "$min" | awk -F. '{printf "%04d%04d%04d\n", $1, $2, $3}')
    [[ "$cur_norm" -ge "$min_norm" ]]
}

# --- MySQL 查询封装 ---
mysql_query() {
    local sql="$1"
    if [[ -n "$DB_PASS" ]]; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -N -e "$sql" "$DB_NAME" 2>/dev/null || echo ""
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -e "$sql" "$DB_NAME" 2>/dev/null || echo ""
    fi
}

# ============================================================
# 1. 基础环境检查
# ============================================================
section "1. 基础环境"

# PHP 版本
if command -v php &>/dev/null; then
    PHP_VER=$(php -r "echo PHP_VERSION;" 2>/dev/null || echo "0.0.0")
    if version_gte "$PHP_VER" "8.0.2"; then
        pass "PHP 版本: ${PHP_VER} (≥8.0.2)"
    else
        fail "PHP 版本: ${PHP_VER}，需要 ≥8.0.2 | 修复: 升级 PHP"
    fi
else
    fail "PHP 未安装 | 修复: apt install php8.1-fpm php8.1-cli"
fi

# MySQL 版本
if command -v mysql &>/dev/null; then
    MYSQL_VER=$(mysql --version 2>/dev/null | grep -oP '\d+\.\d+' | head -1 || echo "0.0")
    if version_gte "${MYSQL_VER}.0" "5.6.0"; then
        pass "MySQL 版本: ${MYSQL_VER} (≥5.6)"
    else
        fail "MySQL 版本: ${MYSQL_VER}，需要 ≥5.6 | 修复: 升级 MySQL"
    fi
else
    fail "MySQL CLI 未安装 | 修复: apt install mysql-client"
fi

# Composer
if command -v composer &>/dev/null; then
    COMP_VER=$(composer --version 2>/dev/null | head -1 || echo "未知版本")
    pass "Composer: ${COMP_VER}"
else
    fail "Composer 未安装 | 修复: apt install composer 或从 https://getcomposer.org 安装"
fi

# ============================================================
# 2. PHP 扩展检查
# ============================================================
section "2. PHP 扩展"

if command -v php &>/dev/null; then
    REQUIRED_EXTS="pdo_mysql mbstring curl gd openssl json xml"
    for ext in $REQUIRED_EXTS; do
        if php -m 2>/dev/null | grep -qi "^${ext}$"; then
            pass "PHP 扩展: ${ext}"
        else
            fail "PHP 扩展: ${ext} 缺失 | 修复: apt install php8.1-${ext}"
        fi
    done

    OPT_EXTS="redis bcmath"
    for ext in $OPT_EXTS; do
        if php -m 2>/dev/null | grep -qi "^${ext}$"; then
            pass "PHP 扩展(可选): ${ext}"
        else
            warn "PHP 扩展(可选): ${ext} 缺失 | 建议: apt install php8.1-${ext}"
        fi
    done
else
    warn "PHP 不可用，跳过扩展检查"
fi

# ============================================================
# 3. 目录权限检查
# ============================================================
section "3. 目录权限"

DIRS_TO_CHECK="runtime public/static/upload public/download public/storage rsakeys resources"
for dir in $DIRS_TO_CHECK; do
    FULL_PATH="${BACKEND_PATH}/${dir}"
    if [[ -d "$FULL_PATH" ]]; then
        if [[ -w "$FULL_PATH" ]]; then
            pass "目录可写: ${dir}"
        else
            fail "目录不可写: ${dir} | 修复: chmod -R 755 ${dir} && chown -R www-data:www-data ${dir}"
        fi
    else
        warn "目录不存在: ${dir} | 可能需要创建: mkdir -p ${FULL_PATH} && chmod 755 ${FULL_PATH}"
    fi
done

# ============================================================
# 4. 安全检查
# ============================================================
section "4. 安全配置"

# install.php 是否已删除
INSTALL_FILE="${BACKEND_PATH}/public/install.php"
if [[ -f "$INSTALL_FILE" ]]; then
    fail "install.php 仍存在 | 修复: rm ${INSTALL_FILE}"
else
    pass "install.php 已删除"
fi

# APP_DEBUG
if [[ -f "${BACKEND_PATH}/.env" ]]; then
    DEBUG_VAL=$(grep -i "^APP_DEBUG" "${BACKEND_PATH}/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ' | tr '[:upper:]' '[:lower:]')
    if [[ "$DEBUG_VAL" == "true" ]] || [[ "$DEBUG_VAL" == "1" ]]; then
        fail "APP_DEBUG = true | 修复: 修改 .env 中 APP_DEBUG=false"
    else
        pass "APP_DEBUG 已关闭"
    fi
else
    pass ".env 不存在（默认关闭调试）"
fi

# show_error_msg
CONFIG_APP="${BACKEND_PATH}/config/app.php"
if [[ -f "$CONFIG_APP" ]]; then
    SHOW_ERR=$(grep -i "show_error_msg" "$CONFIG_APP" 2>/dev/null | head -1 || echo "")
    if echo "$SHOW_ERR" | grep -qi "true"; then
        fail "show_error_msg = true | 修复: 修改 config/app.php 中 show_error_msg => false"
    else
        pass "show_error_msg 已关闭"
    fi
else
    warn "config/app.php 不存在 | 可能尚未完成安装"
fi

# 管理后台入口
ADMIN_FILES=$(ls "${BACKEND_PATH}/public"/admin*.php 2>/dev/null || true)
if [[ -n "$ADMIN_FILES" ]]; then
    ADMIN_NAME=$(basename $ADMIN_FILES | head -1)
    pass "管理后台入口: ${ADMIN_NAME}"
else
    warn "未找到管理后台入口文件 (public/admin*.php) | 可能尚未完成安装"
fi

# ============================================================
# 5. 数据库连接检查
# ============================================================
section "5. 数据库连接"

DB_CONNECT_OK=0
if command -v mysql &>/dev/null; then
    if [[ -n "$DB_PASS" ]]; then
        if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
            pass "数据库连接成功: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
            DB_CONNECT_OK=1
        else
            fail "数据库连接失败 | 修复: 检查 DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME"
        fi
    else
        if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "SELECT 1;" "$DB_NAME" &>/dev/null; then
            pass "数据库连接成功: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
            DB_CONNECT_OK=1
        else
            fail "数据库连接失败 | 修复: 检查 DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME"
        fi
    fi
else
    fail "mysql CLI 不可用，跳过数据库检查 | 修复: apt install mysql-client"
fi

# ============================================================
# 6-10. 数据库结构检查
# ============================================================
if [[ "$DB_CONNECT_OK" -eq 1 ]]; then
    section "6. 数据库表结构"

    # 表前缀检查
    PREFIX_TABLES=$(mysql_query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME LIKE '${DB_PREFIX}%';")
    PREFIX_TABLES=${PREFIX_TABLES:-0}
    if [[ "$PREFIX_TABLES" -gt 0 ]]; then
        pass "表前缀 ${DB_PREFIX}: 找到 ${PREFIX_TABLES} 张表"
    else
        fail "表前缀 ${DB_PREFIX}: 未找到任何表 | 修复: 检查 DB_PREFIX 是否正确，或确认已执行 migration SQL"
    fi

    # 必需表检查
    REQUIRED_TABLES="activity activity_signup invite_reward muying_feedback user goods_favor config"
    for table in $REQUIRED_TABLES; do
        FULL_TABLE="${DB_PREFIX}${table}"
        EXISTS=$(mysql_query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${FULL_TABLE}';")
        EXISTS=${EXISTS:-0}
        if [[ "$EXISTS" -gt 0 ]]; then
            pass "表存在: ${FULL_TABLE}"
        else
            fail "表缺失: ${FULL_TABLE} | 修复: 执行 muying-final-migration.sql A 段"
        fi
    done

    # 关键字段检查
    section "7. 关键字段"

    FIELD_CHECKS="sxo_activity_signup|privacy_agreed_time sxo_goods_favor|type sxo_user|current_stage sxo_user|due_date sxo_user|baby_birthday sxo_user|invite_code"
    for check in $FIELD_CHECKS; do
        TBL=$(echo "$check" | cut -d'|' -f1)
        COL=$(echo "$check" | cut -d'|' -f2)
        TBL_FULL="${DB_PREFIX}${TBL#sxo_}"
        EXISTS=$(mysql_query "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${TBL_FULL}' AND COLUMN_NAME='${COL}';")
        EXISTS=${EXISTS:-0}
        if [[ "$EXISTS" -gt 0 ]]; then
            pass "字段存在: ${TBL_FULL}.${COL}"
        else
            fail "字段缺失: ${TBL_FULL}.${COL} | 修复: 执行 muying-final-migration.sql B 段"
        fi
    done

    # 关键索引检查
    section "8. 关键索引"

    IDX_CHECKS="sxo_user|uk_invite_code sxo_invite_reward|uk_inviter_invitee_event"
    for check in $IDX_CHECKS; do
        TBL=$(echo "$check" | cut -d'|' -f1)
        IDX=$(echo "$check" | cut -d'|' -f2)
        TBL_FULL="${DB_PREFIX}${TBL#sxo_}"
        EXISTS=$(mysql_query "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='${TBL_FULL}' AND INDEX_NAME='${IDX}';")
        EXISTS=${EXISTS:-0}
        if [[ "$EXISTS" -gt 0 ]]; then
            pass "索引存在: ${TBL_FULL}.${IDX}"
        else
            fail "索引缺失: ${TBL_FULL}.${IDX} | 修复: 执行 muying-final-migration.sql C2/C3 段"
        fi
    done

    # 配置项检查
    section "9. 配置项"

    CONFIG_CHECKS="muying_invite_register_reward muying_invite_first_order_reward home_site_name common_app_is_weixin_force_user_base common_user_is_mandatory_bind_mobile home_search_keywords"
    for tag in $CONFIG_CHECKS; do
        VAL=$(mysql_query "SELECT value FROM ${DB_PREFIX}config WHERE only_tag='${tag}';")
        if [[ -n "$VAL" ]]; then
            pass "配置项: ${tag} = ${VAL}"
        else
            fail "配置项缺失: ${tag} | 修复: 执行 yunxi-init-config.sql"
        fi
    done

    # 数据完整性检查
    section "10. 数据完整性"

    EMPTY_CODES=$(mysql_query "SELECT COUNT(*) FROM ${DB_PREFIX}user WHERE invite_code='' OR invite_code IS NULL;")
    if [[ "$EMPTY_CODES" == "0" ]]; then
        pass "所有用户均有邀请码"
    elif [[ "$EMPTY_CODES" == "" ]]; then
        warn "无法检查邀请码空值"
    else
        warn "有 ${EMPTY_CODES} 个用户邀请码为空 | 修复: 执行 muying-final-migration.sql C1 段"
    fi

    ACT_COUNT=$(mysql_query "SELECT COUNT(*) FROM ${DB_PREFIX}activity WHERE is_enable=1 AND is_delete_time=0;")
    ACT_COUNT=${ACT_COUNT:-0}
    if [[ "$ACT_COUNT" -gt 0 ]]; then
        pass "活动数据: ${ACT_COUNT} 条"
    else
        warn "活动数据为空 | 建议: 执行 yunxi-init-activity-demo.sql 或在后台添加活动"
    fi

    FB_COUNT=$(mysql_query "SELECT COUNT(*) FROM ${DB_PREFIX}muying_feedback WHERE is_enable=1 AND is_delete_time=0;")
    FB_COUNT=${FB_COUNT:-0}
    if [[ "$FB_COUNT" -gt 0 ]]; then
        pass "妈妈说数据: ${FB_COUNT} 条"
    else
        warn "妈妈说数据为空 | 建议: 执行 yunxi-init-feedback-demo.sql 或在后台添加"
    fi
fi

# ============================================================
# 汇总
# ============================================================
section "检查汇总"

TOTAL=$((PASS_COUNT + WARN_COUNT + FAIL_COUNT))
echo -e "  ${C_PASS}PASS: ${PASS_COUNT}${C_RESET}  ${C_WARN}WARN: ${WARN_COUNT}${C_RESET}  ${C_FAIL}FAIL: ${FAIL_COUNT}${C_RESET}  总计: ${TOTAL}"
echo ""

if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo -e "${C_FAIL}不建议上线${C_RESET} — 存在 ${FAIL_COUNT} 个 FAIL 项，请按修复建议逐项处理。"
    exit 1
elif [[ "$STRICT" -eq 1 ]] && [[ "$WARN_COUNT" -gt 0 ]]; then
    echo -e "${C_WARN}不建议上线 (--strict)${C_RESET} — 存在 ${WARN_COUNT} 个 WARN 项，--strict 模式下视为阻断。"
    exit 1
elif [[ "$WARN_COUNT" -gt 0 ]]; then
    echo -e "${C_WARN}建议修复后上线${C_RESET} — 存在 ${WARN_COUNT} 个 WARN 项，不阻断但建议处理。"
    exit 0
else
    echo -e "${C_PASS}可以上线${C_RESET} — 所有检查通过。"
    exit 0
fi
