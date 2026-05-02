#!/usr/bin/env bash
# ============================================================
# 禧孕小程序 — 占位符残留扫描
# ============================================================
#
# 【用途】扫描仓库中残留的占位符或示例值，防止正式发布时遗漏替换
# 【用法】bash check-placeholders.sh [选项] [/path/to/repo]
# 【选项】
#   --no-color   关闭彩色输出
#   --docs-also  同时扫描文档文件（默认只扫描代码和配置）
#   --strict     SQL 中的占位符也视为阻断上线
#   --help       显示帮助
#
# 【退出码】
#   0 — 无阻断上线的问题
#   1 — 存在阻断上线的问题（代码/配置命中，或 --strict 下 SQL 命中）
# ============================================================

set -uo pipefail

REPO_PATH="."
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
echo "目标: ${REPO_PATH}"
echo ""

# --- 扫描规则 ---

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
    'api.xiyun.com'
    'cdn.xiyun.com'
    '/var/www/xiyun'
)

CODE_DEV_PATTERNS=(
    'shopxo_dev_123'
    'root123456'
)

SQL_PATTERNS=(
    '{{CONTACT_PHONE}}'
    '{{APP_ID}}'
    '{{API_DOMAIN}}'
)

DOC_PATTERNS=(
    '{{APP_ID}}'
    '{{APP_SECRET}}'
    '{{API_DOMAIN}}'
    '{{CDN_DOMAIN}}'
    '{{DEPLOY_PATH}}'
    '{{CONTACT_PHONE}}'
    '400-000-0000'
    'api.xiyun.com'
    'cdn.xiyun.com'
    '/var/www/xiyun'
)

CODE_FILE_TYPES=(-name '*.php' -o -name '*.vue' -o -name '*.js' -o -name '*.json' -o -name '*.env' -o -name '*.yml' -o -name '*.yaml' -o -name '*.conf' -o -name '*.sh')

CODE_DEV_FILE_TYPES=(-name '*.php' -o -name '*.env' -o -name '*.env.example' -o -name '*.yml' -o -name '*.yaml' -o -name '*.conf')

SQL_FILE_TYPES=(-name '*.sql')

DOC_FILE_TYPES=(-name '*.md' -o -name '*.txt')

CODE_EXCLUDE=(
    -not -path '*/docs/*'
    -not -path '*/node_modules/*'
    -not -path '*/.git/*'
    -not -path '*/uni_modules/*'
    -not -path '*/unpackage/*'
    -not -path '*/runtime/*'
    -not -path '*/vendor/*'
    -not -path '*/scripts/preflight/check-placeholders.sh'
)

DOC_INCLUDE=(
    -path '*/docs/*'
    -not -path '*/.git/*'
)

# --- 辅助函数 ---

scan_pattern() {
    local label="$1"
    local pattern="$2"
    shift 2

    local results
    results=$(find "$REPO_PATH" -type f \( "$@" \) -exec grep -l "$pattern" {} \; 2>/dev/null || true)
    if [[ -n "$results" ]]; then
        echo -e "${C_FAIL}[${label}] 发现: ${pattern}${C_RESET}"
        while IFS= read -r f; do
            [[ -z "$f" ]] && continue
            rel_path="${f#$REPO_PATH/}"
            grep -n "$pattern" "$f" 2>/dev/null | head -3 | while IFS= read -r line; do
                echo "        ${line}"
            done
            echo "    ${rel_path}"
        done <<< "$results"
        return 1
    fi
    return 0
}

# --- 1. 扫描代码/配置中的占位符 ---

echo "--- 代码/配置: 占位符扫描 ---"

for pattern in "${CODE_PATTERNS[@]}"; do
    if ! scan_pattern "FAIL" "$pattern" "${CODE_FILE_TYPES[@]}" "${CODE_EXCLUDE[@]}"; then
        CODE_HIT=$((CODE_HIT + 1))
    fi
done

if [[ $CODE_HIT -eq 0 ]]; then
    echo -e "${C_INFO}[PASS] 代码/配置中无占位符残留${C_RESET}"
fi

# --- 2. 扫描代码/配置中的开发默认值 ---

echo ""
echo "--- 代码/配置: 开发默认值扫描 ---"

for pattern in "${CODE_DEV_PATTERNS[@]}"; do
    if ! scan_pattern "FAIL" "$pattern" "${CODE_DEV_FILE_TYPES[@]}" "${CODE_EXCLUDE[@]}"; then
        CODE_HIT=$((CODE_HIT + 1))
    fi
done

if [[ $CODE_HIT -eq 0 ]]; then
    echo -e "${C_INFO}[PASS] 代码/配置中无开发默认值残留${C_RESET}"
fi

# --- 3. 扫描 manifest.json 空 AppID ---

echo ""
echo "--- 代码/配置: 空 AppID 检查 ---"

manifest_file=$(find "$REPO_PATH" -path '*/shopxo-uniapp/manifest.json' -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/unpackage/*' 2>/dev/null | head -1)
if [[ -n "$manifest_file" ]]; then
    in_weixin_block=0
    weixin_appid=""
    weixin_appid_line=""
    line_num=0
    while IFS= read -r line; do
        line_num=$((line_num + 1))
        if echo "$line" | grep -q '"mp-weixin"'; then
            in_weixin_block=1
            continue
        fi
        if [[ $in_weixin_block -eq 1 ]]; then
            if echo "$line" | grep -q '"appid"'; then
                weixin_appid=$(echo "$line" | sed -n 's/.*"appid"\s*:\s*"\([^"]*\)".*/\1/p')
                weixin_appid_line="${line_num}:${line}"
                break
            fi
            if echo "$line" | grep -qE '^\s*\}'; then
                break
            fi
        fi
    done < "$manifest_file"

    if [[ -n "$weixin_appid_line" ]]; then
        if [[ -z "$weixin_appid" ]]; then
            echo -e "${C_FAIL}[FAIL] manifest.json 中 mp-weixin.appid 为空${C_RESET}"
            echo "    ${manifest_file#$REPO_PATH/}"
            echo "        ${weixin_appid_line}"
            CODE_HIT=$((CODE_HIT + 1))
        else
            echo -e "${C_INFO}[PASS] manifest.json mp-weixin.appid = ${weixin_appid}${C_RESET}"
        fi
    else
        echo -e "${C_WARN}[WARN] manifest.json 中未找到 mp-weixin.appid 字段${C_RESET}"
    fi
else
    echo -e "${C_WARN}[WARN] 未找到 manifest.json${C_RESET}"
fi

# --- 4. 扫描 .env 中 APP_DEBUG=true ---

echo ""
echo "--- 代码/配置: 调试开关检查 ---"

env_files=()
while IFS= read -r -d '' f; do
    env_files+=("$f")
done < <(find "$REPO_PATH" -type f \( -name '.env' -o -name '.env.example' \) -not -path '*/.git/*' -not -path '*/node_modules/*' -print0 2>/dev/null)

env_debug_hit=0
for env_file in "${env_files[@]}"; do
    rel_path="${env_file#$REPO_PATH/}"
    debug_line=$(grep -n 'APP_DEBUG' "$env_file" 2>/dev/null | grep -i 'true' | head -1)
    if [[ -n "$debug_line" ]]; then
        echo -e "${C_FAIL}[FAIL] ${rel_path} 中 APP_DEBUG=true（生产必须改为 false）${C_RESET}"
        echo "        ${debug_line}"
        env_debug_hit=$((env_debug_hit + 1))
    fi
done
CODE_HIT=$((CODE_HIT + env_debug_hit))

if [[ $env_debug_hit -eq 0 ]]; then
    if [[ ${#env_files[@]} -gt 0 ]]; then
        echo -e "${C_INFO}[PASS] .env 中 APP_DEBUG=false 或未设置${C_RESET}"
    else
        echo -e "${C_WARN}[WARN] 未找到 .env 文件${C_RESET}"
    fi
fi

# --- 5. 扫描 Nginx 配置中 localhost ---

echo ""
echo "--- 代码/配置: Nginx server_name 检查 ---"

nginx_files=()
while IFS= read -r -d '' f; do
    nginx_files+=("$f")
done < <(find "$REPO_PATH" -type f -name '*.conf' -not -path '*/.git/*' -not -path '*/node_modules/*' -print0 2>/dev/null)

nginx_localhost_hit=0
for nginx_file in "${nginx_files[@]}"; do
    rel_path="${nginx_file#$REPO_PATH/}"
    server_name_line=$(grep -n 'server_name' "$nginx_file" 2>/dev/null | grep 'localhost' | head -1)
    if [[ -n "$server_name_line" ]]; then
        echo -e "${C_WARN}[WARN] ${rel_path} 中 server_name 为 localhost（生产需替换）${C_RESET}"
        echo "        ${server_name_line}"
        nginx_localhost_hit=$((nginx_localhost_hit + 1))
    fi
done

if [[ $nginx_localhost_hit -eq 0 ]]; then
    if [[ ${#nginx_files[@]} -gt 0 ]]; then
        echo -e "${C_INFO}[PASS] Nginx server_name 非 localhost${C_RESET}"
    fi
fi

# --- 6. 扫描 SQL 文件中的占位符 ---

echo ""
echo "--- SQL 文件: 占位符扫描 ---"

sql_hit_before=$SQL_HIT
for pattern in "${SQL_PATTERNS[@]}"; do
    if ! scan_pattern "SQL" "$pattern" "${SQL_FILE_TYPES[@]}" -not -path '*/.git/*' -not -path '*/node_modules/*'; then
        SQL_HIT=$((SQL_HIT + 1))
    fi
done

if [[ $SQL_HIT -eq $sql_hit_before ]]; then
    echo -e "${C_INFO}[PASS] SQL 文件中无残留占位符${C_RESET}"
fi

# --- 7. 扫描文档（可选） ---

if [[ $DOCS_ALSO -eq 1 ]]; then
    echo ""
    echo "--- 文档扫描 ---"

    doc_hit_before=$DOC_HIT
    for pattern in "${DOC_PATTERNS[@]}"; do
        if ! scan_pattern "WARN" "$pattern" "${DOC_FILE_TYPES[@]}" "${DOC_INCLUDE[@]}"; then
            DOC_HIT=$((DOC_HIT + 1))
        fi
    done

    if [[ $DOC_HIT -eq $doc_hit_before ]]; then
        echo "文档中无残留占位符"
    fi
fi

# --- 汇总 ---

echo ""
echo "=========================================="
echo " 扫描结果"
echo "=========================================="

TOTAL_FAIL=$CODE_HIT
if [[ $STRICT -eq 1 ]]; then
    TOTAL_FAIL=$((TOTAL_FAIL + SQL_HIT))
fi

echo ""
echo "  代码/配置 FAIL: ${CODE_HIT}"
if [[ $STRICT -eq 1 ]]; then
    echo "  SQL 占位符:     ${SQL_HIT} (--strict, 阻断)"
else
    echo "  SQL 占位符:     ${SQL_HIT} (不阻断)"
fi
echo "  文档占位符:     ${DOC_HIT} (不阻断)"
echo "  合计阻断项:     ${TOTAL_FAIL}"
echo ""

if [[ $TOTAL_FAIL -gt 0 ]]; then
    echo -e "${C_FAIL}存在 ${TOTAL_FAIL} 个阻断上线的问题 → 不建议上线${C_RESET}"
    echo ""
    echo "必须在发布前替换以下占位符/默认值："
    echo "  {{APP_ID}}         → 微信小程序 AppID"
    echo "  {{API_DOMAIN}}     → 后端 API 域名"
    echo "  {{CONTACT_PHONE}}  → 真实客服电话"
    echo "  400-000-0000       → 真实客服电话"
    echo "  api.xiyun.com      → 实际 API 域名"
    echo "  /var/www/xiyun     → 实际部署路径"
    echo "  shopxo_dev_123     → 生产数据库密码"
    echo "  root123456         → 生产数据库密码"
    echo "  manifest.json appid → 微信小程序 AppID"
    echo "  APP_DEBUG=true     → 改为 false"
    echo ""
    echo "参考: docs/release/release-values-template.md"
    echo ""
    echo "退出码: 1"
    exit 1
else
    echo -e "${C_INFO}代码/配置中无残留占位符 → 可以上线${C_RESET}"
    if [[ $SQL_HIT -gt 0 ]]; then
        echo -e "${C_WARN}提示: SQL 中有 ${SQL_HIT} 个占位符（执行前需手动替换，不阻断扫描）${C_RESET}"
        echo "      使用 --strict 可将 SQL 占位符视为阻断上线"
    fi
    if [[ $DOCS_ALSO -eq 1 ]] && [[ $DOC_HIT -gt 0 ]]; then
        echo -e "${C_WARN}提示: 文档中有 ${DOC_HIT} 个占位符（仅文档示例，不阻断上线）${C_RESET}"
    fi
    echo ""
    echo "退出码: 0"
    exit 0
fi
