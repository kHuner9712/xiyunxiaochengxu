#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 回滚指南与脚本
# ============================================================
#
# 【用途】部署失败或上线后出问题时，快速回滚到上一版本
# 【用法】
#   查看指南: bash rollback-guide.sh --help
#   执行回滚: bash rollback-guide.sh --site-dir /path/to/site --backup-dir /path/to/backup
#
# 【回滚策略】
#   1. 代码回滚: git checkout 到上一个 commit
#   2. 数据库回滚: 从备份 SQL 恢复
#   3. 配置回滚: 恢复 .env 备份
#
# 【前提】
#   - 部署前已创建备份（见下方备份命令）
#   - 有数据库备份文件
#
# 【退出码】0=成功，1=失败
# ============================================================

set -uo pipefail

SITE_DIR=""
BACKUP_DIR=""
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME=""
DB_USER=""
DB_PASS=""
CONFIRM=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --site-dir=*)    SITE_DIR="${1#*=}"; shift ;;
        --site-dir)      SITE_DIR="${2:-}"; shift 2 ;;
        --backup-dir=*)  BACKUP_DIR="${1#*=}"; shift ;;
        --backup-dir)    BACKUP_DIR="${2:-}"; shift 2 ;;
        --db-host=*)     DB_HOST="${1#*=}"; shift ;;
        --db-port=*)     DB_PORT="${1#*=}"; shift ;;
        --db-name=*)     DB_NAME="${1#*=}"; shift ;;
        --db-user=*)     DB_USER="${1#*=}"; shift ;;
        --db-pass=*)     DB_PASS="${1#*=}"; shift ;;
        --confirm)       CONFIRM=1; shift ;;
        --help|-h)
            echo ""
            echo "回滚指南"
            echo "========"
            echo ""
            echo "一、部署前备份（每次部署前必须执行）"
            echo ""
            echo "  # 1. 备份数据库"
            echo "  mysqldump -h DB_HOST -u DB_USER -pDB_PASS DB_NAME > /path/to/backup/db_\$(date +%Y%m%d_%H%M%S).sql"
            echo ""
            echo "  # 2. 备份 .env"
            echo "  cp /path/to/site/.env /path/to/backup/env_\$(date +%Y%m%d_%H%M%S)"
            echo ""
            echo "  # 3. 备份代码（可选，git 可回溯）"
            echo "  cd /path/to/site && git rev-parse HEAD > /path/to/backup/commit_\$(date +%Y%m%d_%H%M%S).txt"
            echo ""
            echo "二、回滚执行"
            echo ""
            echo "  bash scripts/deploy/rollback-guide.sh \\"
            echo "    --site-dir /www/wwwroot/xiyun-api \\"
            echo "    --backup-dir /path/to/backup \\"
            echo "    --db-name DB_NAME --db-user DB_USER --db-pass DB_PASS \\"
            echo "    --confirm"
            echo ""
            echo "三、手动回滚步骤（如果脚本不可用）"
            echo ""
            echo "  # 1. 代码回滚"
            echo "  cd /path/to/site"
            echo "  git log --oneline -5          # 找到上一个 commit"
            echo "  git checkout PREV_COMMIT      # 切到上一版本"
            echo ""
            echo "  # 2. 数据库回滚"
            echo "  mysql -h DB_HOST -u DB_USER -pDB_PASS DB_NAME < /path/to/backup/db_YYYYMMDD_HHMMSS.sql"
            echo ""
            echo "  # 3. 配置回滚"
            echo "  cp /path/to/backup/env_YYYYMMDD_HHMMSS /path/to/site/.env"
            echo ""
            echo "  # 4. 重启 PHP-FPM"
            echo "  systemctl restart php-fpm-81  # 或 /etc/init.d/php-fpm-81 restart"
            echo ""
            echo "  # 5. 清除缓存"
            echo "  rm -rf /path/to/site/runtime/cache/*"
            echo "  rm -rf /path/to/site/runtime/temp/*"
            echo ""
            exit 0
            ;;
        *) shift ;;
    esac
done

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"
step() { echo -e "\n${CYAN}[STEP]${RESET} $1"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $1"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; exit 1; }

if [[ -z "$SITE_DIR" ]]; then fail "--site-dir 必填"; fi
if [[ -z "$BACKUP_DIR" ]]; then fail "--backup-dir 必填"; fi
if [[ $CONFIRM -eq 0 ]]; then
    echo -e "${RED}⚠ 回滚操作不可逆，请加 --confirm 确认执行${RESET}"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  回滚执行"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# --- 1. 恢复 .env ---
step "1. 恢复 .env 配置"
LATEST_ENV=$(ls -t "${BACKUP_DIR}"/env_* 2>/dev/null | head -1)
if [[ -n "$LATEST_ENV" ]]; then
    cp "$LATEST_ENV" "${SITE_DIR}/.env" || fail ".env 恢复失败"
    ok ".env 已从 $(basename "$LATEST_ENV") 恢复"
else
    warn "未找到 .env 备份，跳过"
fi

# --- 2. 代码回滚 ---
step "2. 代码回滚"
LATEST_COMMIT=$(ls -t "${BACKUP_DIR}"/commit_* 2>/dev/null | head -1)
if [[ -n "$LATEST_COMMIT" ]]; then
    PREV_COMMIT=$(cat "$LATEST_COMMIT")
    cd "$SITE_DIR"
    git checkout "$PREV_COMMIT" || fail "git checkout 失败"
    ok "代码已回滚到 commit: ${PREV_COMMIT}"
else
    warn "未找到 commit 备份，尝试 git 回退一个版本"
    cd "$SITE_DIR"
    git checkout HEAD~1 2>/dev/null && ok "代码已回退一个版本" || warn "git 回退失败，请手动处理"
fi

# --- 3. 数据库回滚 ---
step "3. 数据库回滚"
if [[ -n "$DB_NAME" && -n "$DB_USER" ]]; then
    LATEST_DB=$(ls -t "${BACKUP_DIR}"/db_*.sql 2>/dev/null | head -1)
    if [[ -n "$LATEST_DB" ]]; then
        MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"
        [[ -n "$DB_PASS" ]] && MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS"
        $MYSQL_CMD "$DB_NAME" < "$LATEST_DB" || fail "数据库恢复失败"
        ok "数据库已从 $(basename "$LATEST_DB") 恢复"
    else
        warn "未找到数据库备份，跳过"
    fi
else
    warn "未指定数据库信息，跳过数据库回滚"
fi

# --- 4. 清除缓存 ---
step "4. 清除缓存"
rm -rf "${SITE_DIR}/runtime/cache/"* 2>/dev/null
rm -rf "${SITE_DIR}/runtime/temp/"* 2>/dev/null
ok "缓存已清除"

# --- 5. 重启 PHP-FPM ---
step "5. 重启 PHP-FPM"
if systemctl restart php-fpm-81 2>/dev/null; then
    ok "php-fpm-81 已重启"
elif /etc/init.d/php-fpm-81 restart 2>/dev/null; then
    ok "php-fpm-81 已重启"
else
    warn "无法自动重启 PHP-FPM，请手动执行: systemctl restart php-fpm-81"
fi

echo ""
ok "回滚完成"
echo ""
echo "  下一步:"
echo "    1. 访问后端 API 确认恢复正常"
echo "    2. 访问后台确认数据完整"
echo "    3. 重新编译上传前端（如需要）"
echo ""
exit 0
