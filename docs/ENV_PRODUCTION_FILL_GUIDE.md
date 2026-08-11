# `.env.production` 填写指南

真实 `.env.production` 只保存在生产服务器，不提交 Git。以仓库根目录 `.env.production.example` 为唯一字段模板；本指南只解释真实运行时契约，不额外发明配置项。

## 1. 基本规则

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

- Node 运行时满足 `>=22.13.0 <25`。
- Docker 使用 Compose v2，即 `docker compose`。
- 密钥、密码、AppSecret、私钥、证书不得提交仓库。
- `DATABASE_URL` 必须显式填写；数据库密码含 `@ : / # % ? &` 等 URI 保留字符时，对 URL 中用户名/密码部分 percent-encode。
- Docker Compose 会处理 `$` 插值；秘密值含 `$` 时优先按模板说明正确引用/转义。

## 2. 数据库与 Redis

必须正确填写：

- `DB_HOST=mysql`
- `DB_PORT=3306`
- `DB_NAME`
- `DB_USER=root`（当前 Compose 契约）
- `DB_PASSWORD`
- `DATABASE_URL`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD`

production preflight 会把 `DATABASE_URL` 解析后与 `DB_*` 逐项比较，任何 host/port/database/user/password 漂移都会阻断启动。

Redis 容器启动时还会验证宿主机 `vm.overcommit_memory=1`；不满足时拒绝启动。

## 3. 鉴权

必填：

- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `ADMIN_DEFAULT_USERNAME`
- `ADMIN_DEFAULT_PASSWORD`

JWT/Refresh secret 生产至少 32 字符且不得命中弱值；后台初始密码必须满足生产强度门禁。Fresh database 自动创建首管理员并要求首次改密，无需手工 `RUN_SEED=true`。

## 4. 微信小程序与支付

必填真实值：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_MCH_ID`
- `WECHAT_MCH_SERIAL_NO`
- `WECHAT_API_V3_KEY`（32 字节）
- `WECHAT_PRIVATE_KEY_PATH=/app/apps/api/certs/apiclient_key.pem`
- `WECHAT_PLATFORM_CERT_PATH=/app/apps/api/certs/wechatpay_platform.pem`
- `WECHAT_PLATFORM_CERT_SERIAL_NO`

宿主机文件：

- `deploy/certs/apiclient_key.pem`
- `deploy/certs/wechatpay_platform.pem`

平台证书轮换可通过模板中的 `WECHAT_PLATFORM_CERT_MAP` 同时信任多个序列号。

必须保持：

- `WECHAT_SKIP_VERIFY=false`
- `WECHAT_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback`
- `WECHAT_REFUND_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback`

production preflight 会真实解析 RSA 私钥和 X.509 平台证书、校验证书有效期与序列号。

## 5. 正式域名、端口与 CORS

当前生产契约固定：

- `API_DOMAIN=api.yunxixiaochengxu.com.cn`
- `ADMIN_DOMAIN=admin.yunxixiaochengxu.com.cn`
- `HTTP_HOST_PORT=80`
- `HTTPS_HOST_PORT=443`
- `CORS_ORIGINS=https://admin.yunxixiaochengxu.com.cn`
- `UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn`

不要填写任意其他生产域名或非标准公网端口；preflight 会直接拒绝漂移。

## 6. 上传

当前模板：

- `UPLOAD_DIR=/app/apps/api/uploads`
- `UPLOAD_MAX_SIZE=52428800`（50MB）
- `UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4`
- `UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn`

Nginx `client_max_body_size` 为 60MB，用于容纳 multipart 开销。

访问边界：

- `/uploads/public/...` 可静态公开。
- `/uploads/private/...` 返回 403。
- 其他 `/uploads/...` 返回 403。
- 售后图片、营业执照、食品/经营资质等敏感文件通过后端鉴权接口访问。

当前仓库没有 `STORAGE_PROVIDER` 或 `STORAGE_PRIVATE_ASSET_POLICY` 这类生产 env 契约；不要自行添加并假定会生效。

## 7. 可变业务参数不属于 `.env.production`

以下可变业务参数由数据库 `system_configs` 与 Admin “系统配置”控制：

- 未支付订单自动关闭分钟数；
- 发货后自动确认收货天数；
- 售后申请期限；
- 默认运费与包邮门槛；
- 积分抵扣比例与抵扣上限。

不要在生产 env 中填写：

- `ORDER_AUTO_CLOSE_MINUTES`
- `ORDER_AUTO_COMPLETE_DAYS`
- `FREIGHT_FREE_AMOUNT`
- `FREIGHT_DEFAULT_FEE`
- `FREIGHT_REMOTE_FEE`
- `POINTS_DEDUCT_RATE`
- `POINTS_DEDUCT_MAX_PERCENT`

这些名称不是当前生产业务配置入口。偏远地区名单与附加运费当前为代码版本化常量，变更必须经过代码审查与发布。

## 8. HTTPS 证书不是 env 字段

当前 Nginx 证书使用固定宿主机目录，不存在 `SSL_FULLCHAIN_PATH` / `SSL_PRIVKEY_PATH` 生产 env：

API：

- `deploy/nginx/ssl/api/fullchain.pem`
- `deploy/nginx/ssl/api/privkey.pem`

Admin：

- `deploy/nginx/ssl/admin/fullchain.pem`
- `deploy/nginx/ssl/admin/privkey.pem`

## 9. 其他运行参数

模板中可按实际需要确认：

- `LOG_LEVEL`
- `OUTBOUND_HTTP_TIMEOUT_MS`（允许 1000–60000ms）
- `JWT_EXPIRES_IN`
- `JWT_ADMIN_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `ALERT_WEBHOOK_URL`（可选）

保持：

- `SMOKE_TEST_BYPASS_CAPTCHA=false`
- 正常生产启动 `RUN_SEED=false`
- 正常部署不要自行设置 `SKIP_MIGRATE=true` 绕过正式部署流程；正式脚本会在正确阶段控制该值。

## 10. 填完后的唯一部署方式

不要直接 `docker compose up`。

先确认批准的最新 main 40 位 SHA，然后执行：

```bash
EXPECTED_DEPLOY_SHA=<批准的40位main SHA> \
ENV_FILE=.env.production \
bash deploy/scripts/deploy-production.sh
```

生产脚本会再次做配置、证书、数据库连接、迁移克隆、运行时和 smoke 门禁；这些失败都应被视为正确阻断，不得绕过。
