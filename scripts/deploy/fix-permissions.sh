#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 目录权限修复脚本
# ============================================================
#
# 【用途】按安全原则设置后端目录权限和属主
# 【用法】bash fix-permissions.sh [选项] /path/to/site
# 【选项】
#   --user USER    PHP-FPM 运行用户（默认 www）
#   --group GROUP  PHP-FPM 运行用户组（默认 www）
#   --help         显示帮助
#
# 【权限方案说明】
#   宝塔面板 + PHP-FPM + Nginx 组合下：
#   - PHP-FPM 默认以 www:www 用户运行
#   - Nginx 默认以 www:www 用户运行
#   - 站点文件属主应设为 www:www
#   - 目录权限 755（owner=rwx, group=rx, other=rx）
#   - 文件权限 644（owner=rw, group=r, other=r）
#   - 必须可写的目录单独设 755（保持执行位，不开放 other 写）
#   - 绝不使用 777
#
# 【必须可写的目录】
#   runtime/          — ThinkPHP 运行时缓存/日志/编译
#   public/upload/    — 用户上传文件
#   public/download/  — 下载文件
#   config/           — 后台配置写入（.env 和 config 缓存）
#   public/rsakeys/   — RSA 密钥存储
#
# 【不应可写的目录】
#   app/              — 应用代码
#   vendor/           — Composer 依赖
#   extend/           — 扩展代码
#   public/*.php      — 入口文件
#
# 【退出码】0=成功，1=失败
# ============================================================

set -uo pipefail

SITE_DIR=""
WEB_USER="www"
WEB_GROUP="www"

for arg in "$@"; do
    case "$arg" in
        --user=*)   WEB_USER="${arg#*=}"; shift ;;
        --user)     WEB_USER="${2:-}"; shift 2 ;;
        --group=*)  WEB_GROUP="${arg#*=}"; shift ;;
        --group)    WEB_GROUP="${2:-}"; shift 2 ;;
        --help|-h)  head -36 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        -*)         echo "未知选项: $arg" >&2; exit 1 ;;
        *)          SITE_DIR="$arg"; shift ;;
    esac
done

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"
step() { echo -e "\n${CYAN}[STEP]${RESET} $1"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $1"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; exit 1; }

if [[ -z "$SITE_DIR" ]]; then fail "请指定站点目录路径"; fi
if [[ ! -d "$SITE_DIR" ]]; then fail "站点目录不存在: ${SITE_DIR}"; fi

echo ""
echo "=========================================="
echo " 目录权限修复"
echo "=========================================="
echo "  站点目录: ${SITE_DIR}"
echo "  运行用户: ${WEB_USER}:${WEB_GROUP}"
echo ""

# --- 1. 设置属主 ---
step "1. 设置文件属主为 ${WEB_USER}:${WEB_GROUP}"
if id "$WEB_USER" &>/dev/null; then
    chown -R "${WEB_USER}:${WEB_GROUP}" "$SITE_DIR" || fail "chown 失败"
    ok "属主已设为 ${WEB_USER}:${WEB_GROUP}"
else
    warn "用户 ${WEB_USER} 不存在，跳过 chown（请确认 PHP-FPM 运行用户）"
fi

# --- 2. 设置基础权限 ---
step "2. 设置基础权限（目录 755 / 文件 644）"
find "$SITE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || warn "部分目录权限设置失败"
find "$SITE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || warn "部分文件权限设置失败"
ok "基础权限已设置"

# --- 3. 必须可写的目录 ---
step "3. 设置必须可写的目录权限（755）"

WRITABLE_DIRS=(
    "runtime"
    "public/upload"
    "public/download"
    "config"
    "public/rsakeys"
)

for dir in "${WRITABLE_DIRS[@]}"; do
    FULL_PATH="${SITE_DIR}/${dir}"
    if [[ -d "$FULL_PATH" ]]; then
        chmod 755 "$FULL_PATH"
        # 确保目录内文件也可写
        find "$FULL_PATH" -type d -exec chmod 755 {} \; 2>/dev/null
        find "$FULL_PATH" -type f -exec chmod 644 {} \; 2>/dev/null
        ok "${dir}/ → 755（可写）"
    else
        mkdir -p "$FULL_PATH"
        chmod 755 "$FULL_PATH"
        ok "${dir}/ → 已创建，755（可写）"
    fi
done

# --- 4. 确保入口文件不可写 ---
step "4. 保护入口文件（644，不可写）"

ENTRY_FILES=(
    "public/index.php"
    "public/api.php"
    "public/admin.php"
    "public/install.php"
)

for file in "${ENTRY_FILES[@]}"; do
    FULL_PATH="${SITE_DIR}/${file}"
    if [[ -f "$FULL_PATH" ]]; then
        chmod 644 "$FULL_PATH"
        ok "${file} → 644（不可写）"
    fi
done

# --- 5. 验证关键目录权限 ---
step "5. 验证关键目录权限"

VERIFY_DIRS=(
    "runtime|755|可写"
    "public/upload|755|可写"
    "config|755|可写"
    "app|755|只读"
    "vendor|755|只读"
)

ALL_OK=1
for item in "${VERIFY_DIRS[@]}"; do
    DIR="${item%%|*}"
    EXPECTED="${item#*|}"; EXPECTED="${EXPECTED%%|*}"
    DESC="${item##*|}"
    FULL_PATH="${SITE_DIR}/${DIR}"
    if [[ -d "$FULL_PATH" ]]; then
        ACTUAL=$(stat -c "%a" "$FULL_PATH" 2>/dev/null || stat -f "%Lp" "$FULL_PATH" 2>/dev/null || echo "???")
        if [[ "$ACTUAL" == "$EXPECTED" ]]; then
            ok "${DIR}/ → ${ACTUAL} (${DESC})"
        else
            warn "${DIR}/ → ${ACTUAL}（期望 ${EXPECTED}，${DESC}）"
            ALL_OK=0
        fi
    fi
done

echo ""
if [[ $ALL_OK -eq 1 ]]; then
    ok "权限验证通过"
else
    warn "部分目录权限与期望不符，请手动检查"
fi

echo ""
echo "=========================================="
echo " 权限方案总结"
echo "=========================================="
echo ""
echo "  属主:        ${WEB_USER}:${WEB_GROUP}"
echo "  目录默认:    755 (rwxr-xr-x)"
echo "  文件默认:    644 (rw-r--r--)"
echo "  可写目录:    runtime/ public/upload/ public/download/ config/ public/rsakeys/"
echo "  入口文件:    644 (不可写)"
echo "  代码目录:    755 (app/ vendor/ extend/ 不可写)"
echo ""
echo "  ⚠ 绝不使用 777"
echo ""
exit 0
