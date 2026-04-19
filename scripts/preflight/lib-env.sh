#!/usr/bin/env bash
# ============================================================
# 孕禧小程序 — .env 公共解析库
# ============================================================
#
# 【用途】统一解析 ThinkPHP/INI 风格 .env 文件，导出标准化变量
# 【用法】source lib-env.sh && parse_env_file "/path/to/.env"
# 【导出】DB_HOST DB_PORT DB_NAME DB_USER DB_PASS DB_PREFIX
#
# 【解析优先级】
#   1. ThinkPHP/INI 风格（[DATABASE] 段下 HOSTNAME= 等）
#   2. 扁平变量风格（DB_HOST= 等，作为兼容回退）
#   3. 已有的环境变量（不被 .env 覆盖，除非 .env 中显式设置）
#
# 【INI 风格映射】
#   [DATABASE]          → 统一变量
#   HOSTNAME            → DB_HOST
#   HOSTPORT            → DB_PORT
#   DATABASE            → DB_NAME
#   USERNAME            → DB_USER
#   PASSWORD            → DB_PASS
#   PREFIX              → DB_PREFIX
# ============================================================

parse_env_file() {
    local env_file="$1"

    if [[ -z "$env_file" ]]; then
        return 0
    fi

    if [[ ! -f "$env_file" ]]; then
        echo "错误: .env 文件不存在: $env_file" >&2
        return 1
    fi

    local current_section=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        [[ -z "$line" ]] && continue
        [[ "$line" == \#* ]] && continue

        if [[ "$line" =~ ^\[([^]]+)\]$ ]]; then
            current_section=$(echo "${BASH_REMATCH[1]}" | tr '[:lower:]' '[:upper:]')
            continue
        fi

        local key=""
        local value=""
        key=$(echo "$line" | cut -d= -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$line" | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$value" | sed 's/^["'"'"']//;s/["'"'"']$//')

        local upper_key=$(echo "$key" | tr '[:lower:]' '[:upper:]')

        if [[ "$current_section" == "DATABASE" ]]; then
            case "$upper_key" in
                HOSTNAME) DB_HOST="$value" ;;
                HOSTPORT) DB_PORT="$value" ;;
                DATABASE) DB_NAME="$value" ;;
                USERNAME) DB_USER="$value" ;;
                PASSWORD) DB_PASS="$value" ;;
                PREFIX)   DB_PREFIX="$value" ;;
            esac
        fi

        case "$upper_key" in
            DB_HOST)   DB_HOST="$value" ;;
            DB_PORT)   DB_PORT="$value" ;;
            DB_NAME)   DB_NAME="$value" ;;
            DB_USER)   DB_USER="$value" ;;
            DB_PASS)   DB_PASS="$value" ;;
            DB_PREFIX) DB_PREFIX="$value" ;;
        esac
    done < "$env_file"

    return 0
}
