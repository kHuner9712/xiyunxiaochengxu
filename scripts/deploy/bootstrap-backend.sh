#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 后端引导部署脚本
# ============================================================
#
# 【用途】在服务器上首次部署后端代码，完成从克隆到可访问的全流程
# 【用法】bash bootstrap-backend.sh [选项]
# 【选项】
#   --site-dir PATH      站点目录（必填，如 /www/wwwroot/xiyun-api）
#   --repo URL           Git 仓库地址（默认 https://github.com/kHuner9712/xiyun.git）
#   --env=experience     体验版模式（APP_DEBUG=true，允许 IP）
#   --env=submit         提审模式（APP_DEBUG=false，要求 HTTPS 域名）
#   --db-host HOST       数据库主机（默认 127.0.0.1）
#   --db-port PORT       数据库端口（默认 3306）
#   --db-name NAME       数据库名（必填）
#   --db-user USER       数据库用户（必填）
#   --db-pass PASS       数据库密码（必填）
#   --no-composer        跳过 composer install
#   --help               显示帮助
#
# 【退出码】0=成功，1=失败
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR=""
REPO_URL="https://github.com/kHuner9712/xiyun.git"
DEPLOY_ENV="experience"
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME=""
DB_USER=""
DB_PASS=""
NO_COMPOSER=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --site-dir=*)  SITE_DIR="${1#*=}"; shift ;;
        --site-dir)    SITE_DIR="${2:-}"; shift 2 ;;
        --repo=*)      REPO_URL="${1#*=}"; shift ;;
        --repo)        REPO_URL="${2:-}"; shift 2 ;;
        --env=*)       DEPLOY_ENV="${1#*=}"; shift ;;
        --db-host=*)   DB_HOST="${1#*=}"; shift ;;
        --db-port=*)   DB_PORT="${1#*=}"; shift ;;
        --db-name=*)   DB_NAME="${1#*=}"; shift ;;
        --db-user=*)   DB_USER="${1#*=}"; shift ;;
        --db-pass=*)   DB_PASS="${1#*=}"; shift ;;
        --no-composer) NO_COMPOSER=1; shift ;;
        --help|-h)     head -28 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        *)             echo "未知选项: $1" >&2; exit 1 ;;
    esac
done

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"

step() { echo -e "\n${CYAN}[STEP]${RESET} $1"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $1"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; exit 1; }

# --- 参数校验 ---
if [[ -z "$SITE_DIR" ]]; then fail "--site-dir 必填（如 /www/wwwroot/xiyun-api）"; fi
if [[ -z "$DB_NAME" ]]; then fail "--db-name 必填"; fi
if [[ -z "$DB_USER" ]]; then fail "--db-user 必填"; fi
if [[ "$DEPLOY_ENV" != "experience" && "$DEPLOY_ENV" != "submit" ]]; then
    fail "--env 只支持 experience 或 submit"
fi

echo ""
echo "=========================================="
echo " 禧孕后端引导部署 (模式: ${DEPLOY_ENV})"
echo "=========================================="
echo "  站点目录: ${SITE_DIR}"
echo "  仓库地址: ${REPO_URL}"
echo "  数据库:   ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# --- 1. 克隆代码 ---
step "1. 克隆代码"
if [[ -d "${SITE_DIR}/app" ]]; then
    warn "站点目录已存在代码，跳过克隆"
else
    TMP_DIR=$(mktemp -d)
    git clone "$REPO_URL" "$TMP_DIR/repo" || fail "git clone 失败"
    mkdir -p "$SITE_DIR"
    cp -r "${TMP_DIR}/repo/shopxo-backend/"* "$SITE_DIR/" || fail "复制后端代码失败"
    rm -rf "$TMP_DIR"
    ok "代码已克隆到 ${SITE_DIR}"
fi

# --- 2. 配置 .env ---
step "2. 配置 .env"
if [[ -f "${SITE_DIR}/.env" ]]; then
    warn ".env 已存在，跳过（如需重新生成请先删除）"
else
    if [[ -f "${SITE_DIR}/.env.production.example" ]]; then
        cp "${SITE_DIR}/.env.production.example" "${SITE_DIR}/.env"
    else
        fail ".env.production.example 不存在"
    fi

    # 填入数据库配置
    if grep -q '{{DB_HOST}}' "${SITE_DIR}/.env"; then
        sed -i "s/{{DB_HOST}}/${DB_HOST}/g" "${SITE_DIR}/.env"
        sed -i "s/{{DB_PORT}}/${DB_PORT}/g" "${SITE_DIR}/.env"
        sed -i "s/{{DB_NAME}}/${DB_NAME}/g" "${SITE_DIR}/.env"
        sed -i "s/{{DB_USER}}/${DB_USER}/g" "${SITE_DIR}/.env"
        sed -i "s/{{DB_PASS}}/${DB_PASS}/g" "${SITE_DIR}/.env"
        sed -i "s/{{DB_PREFIX}}/sxo_/g" "${SITE_DIR}/.env"
    else
        # INI 风格 .env
        sed -i "s/^HOSTNAME=.*/HOSTNAME = ${DB_HOST}/" "${SITE_DIR}/.env"
        sed -i "s/^DATABASE=.*/DATABASE = ${DB_NAME}/" "${SITE_DIR}/.env"
        sed -i "s/^USERNAME=.*/USERNAME = ${DB_USER}/" "${SITE_DIR}/.env"
        sed -i "s/^PASSWORD=.*/PASSWORD = ${DB_PASS}/" "${SITE_DIR}/.env"
        sed -i "s/^HOSTPORT=.*/HOSTPORT = ${DB_PORT}/" "${SITE_DIR}/.env"
    fi

    # APP_DEBUG
    if [[ "$DEPLOY_ENV" == "experience" ]]; then
        sed -i 's/APP_DEBUG\s*=.*/APP_DEBUG = true/' "${SITE_DIR}/.env"
        ok "APP_DEBUG = true（体验版模式）"
    else
        sed -i 's/APP_DEBUG\s*=.*/APP_DEBUG = false/' "${SITE_DIR}/.env"
        ok "APP_DEBUG = false（提审模式）"
    fi

    ok ".env 已配置"
fi

# --- 3. 安装依赖 ---
step "3. 安装 Composer 依赖"
if [[ $NO_COMPOSER -eq 1 ]]; then
    warn "跳过 composer install（--no-composer）"
elif [[ -d "${SITE_DIR}/vendor" ]]; then
    warn "vendor 目录已存在，跳过 composer install"
else
    cd "$SITE_DIR"
    if command -v composer &>/dev/null; then
        composer install --no-dev --optimize-autoloader --no-interaction || fail "composer install 失败"
        ok "Composer 依赖已安装"
    else
        fail "composer 未安装，请先安装或使用 --no-composer 跳过"
    fi
fi

# --- 4. 修复权限 ---
step "4. 修复目录权限"
bash "${SCRIPT_DIR}/fix-permissions.sh" "$SITE_DIR" || fail "权限修复失败"
ok "目录权限已修复"

# --- 5. 导入数据库 ---
step "5. 导入数据库和迁移"
bash "${SCRIPT_DIR}/run-migrations.sh" \
    --db-host="$DB_HOST" --db-port="$DB_PORT" \
    --db-name="$DB_NAME" --db-user="$DB_USER" --db-pass="$DB_PASS" \
    --site-dir="$SITE_DIR" || fail "数据库导入失败"
ok "数据库已导入"

# --- 6. 部署后检查 ---
step "6. 部署后检查"
bash "${SCRIPT_DIR}/post-deploy-check.sh" \
    --site-dir="$SITE_DIR" \
    --db-host="$DB_HOST" --db-port="$DB_PORT" \
    --db-name="$DB_NAME" --db-user="$DB_USER" --db-pass="$DB_PASS" \
    --env="$DEPLOY_ENV"

echo ""
echo "=========================================="
echo " 后端引导部署完成 (模式: ${DEPLOY_ENV})"
echo "=========================================="
echo ""
echo "  下一步:"
echo "    1. 配置 Nginx 站点（参照 docs/release/bt-deploy-rollback-guide.md）"
echo "    2. 访问 http://你的IP/admin.php 登录后台"
echo "    3. 按 docs/release/admin-first-login-checklist.md 完成后台配置"
echo ""
