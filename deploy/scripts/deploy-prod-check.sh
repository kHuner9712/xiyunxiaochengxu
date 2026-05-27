#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"

REQUIRED_IP="62.234.69.19"
API_DOMAIN="api.yunxixiaochengxu.com.cn"
ADMIN_DOMAIN="admin.yunxixiaochengxu.com.cn"

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}WARN${NC} $1"; }
info() { echo -e "${CYAN}INFO${NC} $1"; }

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN} 禧孕优选 预生产部署检查与启动脚本${NC}"
echo -e "${CYAN}============================================${NC}"

if [ ! -f "$ENV_FILE" ]; then
  fail ".env.production 不存在：$ENV_FILE"
fi
pass "检测到环境文件：$ENV_FILE"

declare -A ENV_VALUES

trim_space() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

parse_env_file() {
  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    local line="$raw_line"
    line="${line%$'\r'}"
    line="$(trim_space "$line")"
    if [ -z "$line" ] || [[ "$line" == \#* ]]; then
      continue
    fi

    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="$(trim_space "$line")"
    fi

    if [[ ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      warn "忽略无法解析的 .env 行（非 KEY=VALUE 格式）"
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"
    value="$(trim_space "$value")"

    if [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:-1}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:-1}"
    fi

    ENV_VALUES["$key"]="$value"
  done < "$ENV_FILE"
}

get_env_value() {
  local key="$1"
  if [[ -n "${ENV_VALUES[$key]+x}" ]]; then
    printf '%s' "${ENV_VALUES[$key]}"
  else
    printf '%s' "${!key:-}"
  fi
}

parse_env_file

required_vars=(
  DATABASE_URL
  REDIS_HOST
  REDIS_PASSWORD
  JWT_SECRET
  REFRESH_TOKEN_SECRET
  WECHAT_APP_ID
  WECHAT_APP_SECRET
  WECHAT_MCH_ID
  WECHAT_MCH_SERIAL_NO
  WECHAT_API_V3_KEY
  WECHAT_PRIVATE_KEY_PATH
  WECHAT_PLATFORM_CERT_PATH
  WECHAT_PLATFORM_CERT_SERIAL_NO
  WECHAT_NOTIFY_URL
  WECHAT_REFUND_NOTIFY_URL
  CORS_ORIGINS
  DB_PASSWORD
  ADMIN_DEFAULT_PASSWORD
)

for var in "${required_vars[@]}"; do
  value="$(get_env_value "$var")"
  if [ -z "$value" ]; then
    fail "缺少必填变量：$var"
  fi
done
pass "必填环境变量完整"

is_weak_secret() {
  local value
  value="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    ""|changeme|change_this*|password|123456|12345678|admin|secret|test|your_*|default*|baby_mall_2024|change_this_jwt_secret)
      return 0
      ;;
  esac
  if [ "${#1}" -lt 16 ]; then
    return 0
  fi
  if [[ ! "$1" =~ [A-Z] ]] || [[ ! "$1" =~ [a-z] ]] || [[ ! "$1" =~ [0-9] ]] || [[ ! "$1" =~ [^A-Za-z0-9] ]]; then
    return 0
  fi
  return 1
}

for key in DB_PASSWORD REDIS_PASSWORD JWT_SECRET REFRESH_TOKEN_SECRET ADMIN_DEFAULT_PASSWORD; do
  value="$(get_env_value "$key")"
  if is_weak_secret "$value"; then
    fail "$key 强度不合规：要求至少16位，并包含大小写字母、数字、特殊字符，且不得使用默认值"
  fi
done
pass "弱口令检查通过"

to_abs_path() {
  local p="$1"
  if [[ "$p" = /* ]]; then
    echo "$p"
  else
    echo "$PROJECT_DIR/$p"
  fi
}

wechat_private_key_path="$(to_abs_path "$(get_env_value WECHAT_PRIVATE_KEY_PATH)")"
wechat_platform_cert_path="$(to_abs_path "$(get_env_value WECHAT_PLATFORM_CERT_PATH)")"
ssl_fullchain_env="$(get_env_value SSL_FULLCHAIN_PATH)"
ssl_privkey_env="$(get_env_value SSL_PRIVKEY_PATH)"
ssl_fullchain_path="${ssl_fullchain_env:-$DEPLOY_DIR/nginx/ssl/fullchain.pem}"
ssl_privkey_path="${ssl_privkey_env:-$DEPLOY_DIR/nginx/ssl/privkey.pem}"

for cert_file in "$wechat_private_key_path" "$wechat_platform_cert_path" "$ssl_fullchain_path" "$ssl_privkey_path"; do
  if [ ! -r "$cert_file" ]; then
    fail "证书文件不可读：$cert_file"
  fi
done
pass "证书文件可读性检查通过"

resolve_domain_ip() {
  local domain="$1"
  local ips=""
  if command -v dig >/dev/null 2>&1; then
    ips="$(dig +short A "$domain" | tr '\n' ' ' | xargs || true)"
  elif command -v getent >/dev/null 2>&1; then
    ips="$(getent ahostsv4 "$domain" | awk '{print $1}' | sort -u | tr '\n' ' ' | xargs || true)"
  elif command -v nslookup >/dev/null 2>&1; then
    ips="$(nslookup "$domain" 2>/dev/null | awk '/^Address: /{print $2}' | tr '\n' ' ' | xargs || true)"
  fi
  echo "$ips"
}

for domain in "$API_DOMAIN" "$ADMIN_DOMAIN"; do
  ips="$(resolve_domain_ip "$domain")"
  if [ -z "$ips" ]; then
    fail "无法解析域名：$domain"
  fi
  if [[ " $ips " != *" $REQUIRED_IP "* ]]; then
    fail "域名解析不符合预期：$domain -> [$ips]，应包含 $REQUIRED_IP"
  fi
  pass "域名解析通过：$domain -> [$ips]"
done

cd "$DEPLOY_DIR"
docker compose --env-file "$ENV_FILE" config >/dev/null
pass "docker compose config 校验通过"

info "启动数据库与缓存容器..."
docker compose --env-file "$ENV_FILE" up -d mysql redis

info "执行 Prisma 迁移..."
docker compose --env-file "$ENV_FILE" run --rm api pnpm --filter @baby-mall/api prisma:migrate:deploy
pass "prisma migrate deploy 执行完成"

info "启动全部服务..."
docker compose --env-file "$ENV_FILE" up -d
pass "服务已启动"

check_http() {
  local name="$1"
  local url="$2"
  local expect_regex="$3"
  local status
  status="$(curl -k -s -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ ! "$status" =~ $expect_regex ]]; then
    fail "$name 检查失败：$url 返回 HTTP $status"
  fi
  pass "$name 检查通过：$url (HTTP $status)"
}

check_http "API 健康检查" "https://${API_DOMAIN}/api/health" "^(200)$"
check_http "Admin 首页" "https://${ADMIN_DOMAIN}/" "^(200|301|302)$"
check_http "uploads 静态资源路由" "https://${API_DOMAIN}/uploads/" "^(200|301|302|403)$"

echo ""
echo -e "${CYAN}下一步真机验收清单：${NC}"
echo "1. 上传小程序体验版（真实 AppID 构建产物）"
echo "2. 微信登录、下单、支付成功、支付取消、支付结果页核对"
echo "3. 后台发货/自提核销/取消订单/确认收货"
echo "4. 售后申请、退款发起、退款回调状态核对"
echo "5. 食品/保健品/奶粉合规字段与提示语真机检查"
echo "6. 客服入口（商品详情、订单详情、我的）逐页点击验证"
echo "7. release:check 与 release:check:prod 在 CI 再跑一遍并留档"
