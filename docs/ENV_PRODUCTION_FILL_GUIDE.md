# `.env.production` 填写辅助清单

本文件只描述**当前代码真正读取、Compose 真正传入、production preflight 真正校验**的生产环境变量。所有真实密钥仅保存在服务器，不得提交 Git。

## 1. 基本安全规则

1. 从 `.env.production.example` 复制：

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

2. `WECHAT_API_V3_KEY` 必须为 32 字节。
3. `JWT_SECRET` / `REFRESH_TOKEN_SECRET` 必须使用随机强密钥，至少 32 字符。
4. 数据库、Redis、初始管理员密码必须为真实强密码，不得保留模板占位值。
5. `WECHAT_PRIVATE_KEY_PATH` 与 `WECHAT_PLATFORM_CERT_PATH` 是**容器内路径**；证书文件实际放在宿主机 `deploy/certs/`。
6. `SMOKE_TEST_BYPASS_CAPTCHA=false`，`WECHAT_SKIP_VERIFY=false`。

## 2. 基础与端口

| 字段 | 生产值/约束 |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000`（API 容器内部端口） |
| `LOG_LEVEL` | 建议 `info` |
| `OUTBOUND_HTTP_TIMEOUT_MS` | 建议 `10000`，允许 `1000-60000` |
| `MYSQL_HOST_PORT` | 默认 `3307`，仅 loopback 暴露 |
| `REDIS_HOST_PORT` | 默认 `6379`，仅 loopback 暴露 |
| `API_HOST_PORT` | 默认 `3001`，仅 loopback 暴露 |
| `HTTP_HOST_PORT` | **必须 `80`** |
| `HTTPS_HOST_PORT` | **必须 `443`** |

## 3. MySQL

必须同时填写并保持一致：

```text
DB_HOST=mysql
DB_PORT=3306
DB_NAME=baby_mall
DB_USER=root
DB_PASSWORD=<真实强密码>
DATABASE_URL=mysql://root:<percent-encoded密码>@mysql:3306/baby_mall
```

production preflight 会逐项比对 `DATABASE_URL` 的协议、host、port、database、user、解码后的 password 与 `DB_*`。任何不一致都会在 live migration 前失败。

如果密码含 `@ : / # % ? &` 等 URI 保留字符，必须在 `DATABASE_URL` 中 percent-encode。例如：

```text
原密码: P@ss#2026
URL密码: P%40ss%232026
```

## 4. Redis

```text
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<真实强密码>
```

当前生产 Redis 还会在 `/health` 检查：

- `maxmemory-policy=noeviction`
- `appendonly=yes`
- `appendfsync=everysec`

宿主机必须满足 `vm.overcommit_memory=1`。

## 5. JWT / 会话

```text
JWT_SECRET=<至少32字符随机强密钥>
JWT_EXPIRES_IN=7d
JWT_ADMIN_EXPIRES_IN=2h
REFRESH_TOKEN_SECRET=<至少32字符随机强密钥>
REFRESH_TOKEN_EXPIRES_IN=30d
```

不要复用 JWT 与 Refresh Token 密钥。

## 6. 微信小程序

```text
WECHAT_APP_ID=<真实AppID>
WECHAT_APP_SECRET=<真实AppSecret>
```

当前 production deployment 还会要求 `WECHAT_APP_ID` 与仓库正式小程序 AppID 契约一致。

## 7. 微信支付 V3

```text
WECHAT_MCH_ID=<真实商户号>
WECHAT_MCH_SERIAL_NO=<真实商户证书序列号>
WECHAT_API_V3_KEY=<真实32字节APIv3 Key>
WECHAT_PRIVATE_KEY_PATH=/app/apps/api/certs/apiclient_key.pem
WECHAT_PLATFORM_CERT_PATH=/app/apps/api/certs/wechatpay_platform.pem
WECHAT_PLATFORM_CERT_SERIAL_NO=<平台证书真实序列号>
WECHAT_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback
WECHAT_REFUND_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback
WECHAT_SKIP_VERIFY=false
```

宿主机文件：

```text
deploy/certs/apiclient_key.pem
deploy/certs/wechatpay_platform.pem
```

轮换平台证书时可选：

```text
WECHAT_PLATFORM_CERT_MAP='{"SERIAL_OLD":"/app/apps/api/certs/wechatpay_platform_old.pem","SERIAL_NEW":"/app/apps/api/certs/wechatpay_platform.pem"}'
```

preflight 会实际解析 RSA 私钥、X.509 平台证书、序列号与有效期。

## 8. 固定生产域名 / CORS / 上传

当前仓库 production contract 固定为：

```text
API_DOMAIN=api.yunxixiaochengxu.com.cn
ADMIN_DOMAIN=admin.yunxixiaochengxu.com.cn
UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn
CORS_ORIGINS=https://admin.yunxixiaochengxu.com.cn
```

不要填写 `api.xxx.com`、其他临时域名或附带 path/query 的 CORS origin；production preflight 会拒绝。

上传：

```text
UPLOAD_DIR=/app/apps/api/uploads
UPLOAD_MAX_SIZE=52428800
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4
```

当前 API 最大上传为 50MB，Nginx body limit 为 60MB（给 multipart 留余量）。

公开/私有语义：

- `/uploads/public/...` 可静态访问；
- `/uploads/private/...` 不可直接静态访问；
- 售后图片、营业执照、商品资质等私有文件通过后端鉴权接口读取。

## 9. 首管理员

```text
ADMIN_DEFAULT_USERNAME=<真实管理员用户名>
ADMIN_DEFAULT_PASSWORD=<真实强密码>
SMOKE_TEST_BYPASS_CAPTCHA=false
```

全新生产数据库在 migration 后检测到 `admin_users=0` 时会自动执行首次安全 seed。已有管理员的数据库不会自动 reseed。首次生产管理员必须改密。

**不要**为了首次部署手工设置 `RUN_SEED=true` 作为标准流程；fresh bootstrap 已由 entrypoint 自动判定。

## 10. 业务参数不属于 `.env.production`

以下参数的运行时来源是数据库 `system_configs` + 管理后台“系统配置”，不要在 `.env.production` 中添加同名变量试图覆盖：

- 订单自动关闭时间（原旧名 `ORDER_AUTO_CLOSE_MINUTES`）
- 自动确认收货天数（原旧名 `ORDER_AUTO_COMPLETE_DAYS`）
- 售后申请期限
- 包邮门槛（原旧名 `FREIGHT_FREE_AMOUNT`）
- 默认运费（原旧名 `FREIGHT_DEFAULT_FEE`）
- 积分抵扣比率（原旧名 `POINTS_DEDUCT_RATE`）
- 积分抵扣上限（原旧名 `POINTS_DEDUCT_MAX_PERCENT`）

运费、包邮门槛等金额型配置在数据库中以**分**保存；管理后台负责“元 ↔ 分”转换。

**偏远地区附加运费是例外**：当前实现仍使用 shared 代码常量，不由 `.env.production` 或 `system_configs` 覆盖。因此同样不要设置 `FREIGHT_REMOTE_FEE` 期待它生效；若未来需要后台可配置，必须先修改实际订单运行时代码并增加迁移/合同测试。

## 11. 不存在的旧配置项

不要添加或依赖以下旧/预留字段：

- `SSL_FULLCHAIN_PATH`
- `SSL_PRIVKEY_PATH`
- `STORAGE_PROVIDER`
- `STORAGE_PRIVATE_ASSET_POLICY`

TLS 路径由部署契约固定：

```text
deploy/nginx/ssl/api/fullchain.pem
deploy/nginx/ssl/api/privkey.pem
deploy/nginx/ssl/admin/fullchain.pem
deploy/nginx/ssl/admin/privkey.pem
```

## 12. 填完后的唯一部署方式

不要直接 `docker compose up` 作为正式发布流程。使用：

```bash
EXPECTED_DEPLOY_SHA=<批准的完整40位main提交SHA> \
ENV_FILE=.env.production \
bash deploy/scripts/deploy-production.sh
```

该入口会在修改 live DB 前运行 production preflight，并执行备份克隆 migration 验证、live migration、health 与完整 runtime smoke。
