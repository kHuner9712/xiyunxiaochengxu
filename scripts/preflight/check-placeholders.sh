#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — 占位符残留扫描
# ============================================================
#
# 【用途】扫描仓库中残留的占位符或示例值，防止正式发布时遗漏替换
# 【用法】bash check-placeholders.sh [/path/to/repo]
# 【选项】
#   --no-color   关闭彩色输出
#   --docs-also  同时扫描文档文件（默认只扫描代码和配置）
#   --strict     SQL 中的占位符也视为阻断上线
#   --help       显示帮助
#
# 【退出码】
#   0 — 代码/配置中无残留占位符
#   1 — 代码/配置中发现残留占位符（阻断上线）
# ============================================================

set -uo pipefail

REPO_PATH="${1:-.}"
NO_COLOR=0
DOCS_ALSO=0
STRICT=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-color)  NO_COLOR=1; shift ;;
        --docs-also) DOCS_ALSO=1; shift ;;
        --strict)    STRICT=1; shift ;;
        --help|-h)   head -17 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
        -*)          echo "未知选项: $1" >&2; exit 1 ;;
        *)           REPO_PATH="$1"; shift ;;
    esac
done

if [[ $NO_COLOR -eq 1 ]] || [[ ! -t 1 ]]; then
    C_FAIL=""; C_WARN=""; C_INFO=""; C_RESET=""
else
    C_FAIL="\033[31m"; C_WARN="\033[33m"; C_INFO="\033[36m"; C_RESET="\033[0m"
fi

CODE_HIT=0
DOC_HIT=0
SQL_HIT=0

echo "=========================================="
echo " 占位符残留扫描"
echo "=========================================="
echo ""

# --- 扫描规则 ---

# 代码/配置中必须替换的占位符（阻断上线）
CODE_PATTERNS=(
    '{{APP_ID}}'
    '{{APP_SECRET}}'
    '{{API_DOMAIN}}'
    '{{CDN_DOMAIN}}'
    '{{DEPLOY_PATH}}'
    '{{DB_HOST}}'
    '{{DB_NAME}}'
    '{{DB_USER}}'
    '{{DB_PASS}}'
    '{{DB_PREFIX}}'
    '{{ADMIN_ENTRY}}'
    '{{SSL_CERT_PATH}}'
    '{{CONTACT_PHONE}}'
    '400-000-0000'
    'api.yunxi.com'
    'cdn.yunxi.com'
    '/var/www/yunxi'
)

# 代码/配置中的开发默认值（阻断上线）
CODE_DEV_PATTERNS=(
    'shopxo_dev_123'
    'root123456'
)

# SQL 文件中的占位符（--strict 时阻断上线）
SQL_PATTERNS=(
    '{{CONTACT_PHONE}}'
    '{{APP_ID}}'
    '{{API_DOMAIN}}'
)

# 文档中的示例值（不阻断但提醒）
DOC_PATTERNS=(
    '{{APP_ID}}'
    '{{APP_SECRET}}'
    '{{API_DOMAIN}}'
    '{{CDN_DOMAIN}}'
    '{{DEPLOY_PATH}}'
    '{{CONTACT_PHONE}}'
    '400-000-0000'
    'api.yunxi.com'
    'cdn.yunxi.com'
    '/var/www/yunxi'
)

# 代码文件范围（排除 docs、node_modules、.git、uni_modules、unpackage、runtime、vendor、脚本自身）
CODE_GLOB=(
    -not -path '*/docs/*'
    -not -path '*/node_modules/*'
    -not -path '*/.git/*'
    -not -path '*/uni_modules/*'
    -not -path '*/unpackage/*'
    -not -path '*/runtime/*'
    -not -path '*/vendor/*'
    -not -path '*/scripts/preflight/check-placeholders.sh'
)

# 文档文件范围
DOC_GLOB=(
    -path '*/docs/*'
    -not -path '*/.git/*'
)

# --- 辅助函数 ---

scan_pattern() {
    local label="$1"
    local pattern="$2"
    local shift_arg="$3"
    local file_types="$4"
    local glob_args=("${@:5}")

    local results
    results=$(find "$REPO_PATH" -type f \( $file_types \) "${glob_args[@]}" -exec grep -l "$pattern" {} \; 2>/dev/null || true)
    if [[ -n "$results" ]]; then
        echo -e "${C_FAIL}[${label}] 发现: ${pattern}${C_RESET}"
        echo "$results" | while read -r f; do
            rel_path="${f#$REPO_PATH/}"
            line=$(grep -n "$pattern" "$f" 2>/dev/null | head -3 | sed 's/^/        /')
            echo "    ${rel_path}"
            echo "$line"
        done
        return 1
    fi
    return 0
}

# --- 1. 扫描代码/配置中的占位符 ---

echo "--- 代码/配置: 占位符扫描 ---"

for pattern in "${CODE_PATTERNS[@]}"; do
    if ! scan_pattern "FAIL" "$pattern" "" "-name '*.php' -o -name '*.vue' -o -name '*.js' -o -name '*.json' -o -name '*.env' -o -name '*.yml' -o -name '*.yaml' -o -name '*.conf' -o -name '*.sh'" "${CODE_GLOB[@]}"; then
        CODE_HIT=$((CODE_HIT + 1))
    fi
done

# --- 2. 扫描代码/配置中的开发默认值 ---

echo ""
echo "--- 代码/配置: 开发默认值扫描 ---"

for pattern in "${CODE_DEV_PATTERNS[@]}"; do
    if ! scan_pattern "FAIL" "$pattern" "" "-name '*.php' -o -name '*.env' -o -name '*.env.example' -o -name '*.yml' -o -name '*.yaml' -o -name '*.conf'" "${CODE_GLOB[@]}"; then
        CODE_HIT=$((CODE_HIT + 1))
    fi
done

# --- 3. 扫描 manifest.json 空 AppID ---

echo ""
echo "--- 代码/配置: 空 AppID 检查 ---"

manifest_file=$(find "$REPO_PATH" -path '*/shopxo-uniapp/manifest.json' -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -1)
if [[ -n "$manifest_file" ]]; then
    appid_line=$(grep -n '"appid"' "$manifest_file" 2>/dev/null | head -1)
    mp_weixin_section=$(grep -A5 '"mp-weixin"' "$manifest_file" 2>/dev/null | grep '"appid"')
    if [[ -n "$mp_weixin_section" ]]; then
        appid_value=$(echo "$mp_weixin_section" | grep -oP '"appid"\s*:\s*"([^"]*)"' | grep -oP '"[^"]*"$' | tr -d '"')
        if [[ -z "$appid_value" ]]; then
            echo -e "${C_FAIL}[FAIL] manifest.json 中 mp-weixin.appid 为空${C_RESET}"
            echo "    ${manifest_file#$REPO_PATH/}"
            echo "        $(grep -n '"appid"' "$manifest_file" | head -1)"
            CODE_HIT=$((CODE_HIT + 1))
        else
            echo -e "${C_INFO}[INFO] manifest.json mp-weixin.appid = ${appid_value}${C_RESET}"
        fi
    fi
else
    echo -e "${C_WARN}[WARN] 未找到 manifest.json${C_RESET}"
fi

# --- 4. 扫描 .env 中 APP_DEBUG=true ---

echo ""
echo "--- 代码/配置: 调试开关检查 ---"

env_files=$(find "$REPO_PATH" -type f \( -name '.env' -o -name '.env.example' \) -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null)
if [[ -n "$env_files" ]]; then
    echo "$env_files" | while read -r env_file; do
        rel_path="${env_file#$REPO_PATH/}"
        debug_line=$(grep -n 'APP_DEBUG' "$env_file" 2>/dev/null | grep -i 'true' | head -1)
        if [[ -n "$debug_line" ]]; then
            echo -e "${C_FAIL}[FAIL] ${rel_path} 中 APP_DEBUG=true（生产必须改为 false）${C_RESET}"
            echo "        ${debug_line}"
            CODE_HIT=$((CODE_HIT + 1))
        fi
    done
fi

# --- 5. 扫描 Nginx 配置中 localhost ---

echo ""
echo "--- 代码/配置: Nginx server_name 检查 ---"

nginx_files=$(find "$REPO_PATH" -type f -name '*.conf' -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null)
if [[ -n "$nginx_files" ]]; then
    echo "$nginx_files" | while read -r nginx_file; do
        rel_path="${nginx_file#$REPO_PATH/}"
        server_name_line=$(grep -n 'server_name' "$nginx_file" 2>/dev/null | grep 'localhost' | head -1)
        if [[ -n "$server_name_line" ]]; then
            echo -e "${C_WARN}[WARN] ${rel_path} 中 server_name 为 localhost（生产需替换）${C_RESET}"
            echo "        ${server_name_line}"
        fi
    done
fi

# --- 6. 扫描 SQL 文件中的占位符 ---

echo ""
echo "--- SQL 文件: 占位符扫描 ---"

sql_files=$(find "$REPO_PATH" -type f -name '*.sql' -not -path '*/.git/*' -not -path '*/node_modules/*' 2>/dev/null)
if [[ -n "$sql_files" ]]; then
    for pattern in "${SQL_PATTERNS[@]}"; do
        if ! scan_pattern "SQL" "$pattern" "" "-name '*.sql'" -not -path '*/.git/*' -not -path '*/node_modules/*'; then
            SQL_HIT=$((SQL_HIT + 1))
        fi
    done
fi

if [[ $SQL_HIT -eq 0 ]]; then
    echo -e "${C_INFO}[INFO] SQL 文件中无残留占位符${C_RESET}"
fi

# --- 7. 扫描文档（可选） ---

if [[ $DOCS_ALSO -eq 1 ]]; then
    echo ""
    echo "--- 文档扫描 ---"

    for pattern in "${DOC_PATTERNS[@]}"; do
        if ! scan_pattern "WARN" "$pattern" "" "-name '*.md' -o -name '*.txt'" "${DOC_GLOB[@]}"; then
            DOC_HIT=$((DOC_HIT + 1))
        fi
    done

    if [[ $DOC_HIT -eq 0 ]]; then
        echo "文档中无残留占位符"
    fi
fi

# --- 汇总 ---

echo ""
echo "=========================================="
echo " 扫描结果"
echo "=========================================="

if [[ $CODE_HIT -gt 0 ]]; then
    echo -e "${C_FAIL}代码/配置中发现 ${CODE_HIT} 个问题 → 阻断上线${C_RESET}"
    echo ""
    echo "必须在发布前替换以下占位符/默认值："
    echo "  {{APP_ID}}         → 微信小程序 AppID"
    echo "  {{API_DOMAIN}}     → 后端 API 域名"
    echo "  {{CONTACT_PHONE}}  → 真实客服电话"
    echo "  400-000-0000       → 真实客服电话"
    echo "  api.yunxi.com      → 实际 API 域名"
    echo "  /var/www/yunxi     → 实际部署路径"
    echo "  shopxo_dev_123     → 生产数据库密码"
    echo "  root123456         → 生产数据库密码"
    echo "  manifest.json appid → 微信小程序 AppID"
    echo "  APP_DEBUG=true     → 改为 false"
    echo ""
    echo "参考: docs/release/release-values-template.md"
fi

if [[ $SQL_HIT -gt 0 ]]; then
    echo ""
    if [[ $STRICT -eq 1 ]]; then
        echo -e "${C_FAIL}SQL 文件中发现 ${SQL_HIT} 个占位符 → 阻断上线（--strict 模式）${C_RESET}"
        echo "执行 SQL 前必须替换所有占位符"
        CODE_HIT=$((CODE_HIT + SQL_HIT))
    else
        echo -e "${C_WARN}SQL 文件中发现 ${SQL_HIT} 个占位符（执行 SQL 前需手动替换，不阻断扫描）${C_RESET}"
        echo "提示: 使用 --strict 可将 SQL 占位符视为阻断上线"
    fi
fi

if [[ $DOCS_ALSO -eq 1 ]] && [[ $DOC_HIT -gt 0 ]]; then
    echo ""
    echo -e "${C_WARN}文档中有 ${DOC_HIT} 个占位符（仅文档示例，不阻断上线）${C_RESET}"
fi

if [[ $CODE_HIT -gt 0 ]]; then
    echo ""
    echo "退出码: 1 (存在阻断上线的问题)"
    exit 1
else
    echo -e "代码/配置中无残留占位符 → 可以上线"
    if [[ $DOCS_ALSO -eq 1 ]] && [[ $DOC_HIT -gt 0 ]]; then
        echo -e "${C_WARN}文档中有 ${DOC_HIT} 个占位符（仅文档示例，不阻断上线）${C_RESET}"
    fi
    if [[ $SQL_HIT -gt 0 ]]; then
        echo -e "${C_WARN}SQL 中有 ${SQL_HIT} 个占位符（执行前需替换，不阻断扫描）${C_RESET}"
    fi
    exit 0
fi
