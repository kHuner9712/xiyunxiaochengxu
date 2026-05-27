# .env.production 填写辅助清单（ENV_PRODUCTION_FILL_GUIDE）

默认约定：以下内容用于服务器本地 `.env.production` 填写，所有真实值均**不得提交 Git**。

## 1. 关键安全规则

1. `WECHAT_API_V3_KEY` 必须为 **32 字节**。
2. `JWT_SECRET` / `REFRESH_TOKEN_SECRET` / `DB_PASSWORD` / `REDIS_PASSWORD` / `ADMIN_DEFAULT_PASSWORD` 至少 16 位，且包含大小写字母、数字、特殊字符。
3. `WECHAT_PRIVATE_KEY_PATH`、`WECHAT_PLATFORM_CERT_PATH` 必须指向容器内可读路径，或与模板约定路径一致。
4. `.env.production` 仅在服务器本地保存，权限建议 `chmod 600 .env.production`。

## 2. 生产必填字段（部署门禁）

| 字段 | 含义 | 从哪里获取 | 示例格式 | 是否敏感 | 是否可提交 Git |
|---|---|---|---|---|---|
| `NODE_ENV` | 运行环境标识 | 运维约定 | `production` | 否 | 否（生产文件不提交） |
| `PORT` | API 监听端口 | 运维约定 | `3000` | 否 | 否 |
| `DB_PASSWORD` | MySQL 密码 | DBA/运维生成 | `XyMall@2026!DbPwd` | 是 | 否 |
| `DATABASE_URL` | 数据库连接串 | 运维按数据库信息组装 | `mysql://root:***@mysql:3306/baby_mall` | 是 | 否 |
| `REDIS_HOST` | Redis 主机名 | 运维部署信息 | `redis` | 否 | 否 |
| `REDIS_PASSWORD` | Redis 密码 | 运维生成 | `XyMall@2026!Redis` | 是 | 否 |
| `JWT_SECRET` | 用户访问令牌签名密钥 | 后端/运维生成 | `随机强密钥` | 是 | 否 |
| `REFRESH_TOKEN_SECRET` | 刷新令牌签名密钥 | 后端/运维生成 | `随机强密钥` | 是 | 否 |
| `WECHAT_APP_ID` | 微信小程序 AppID | 微信公众平台 | `wx1234567890abcd` | 中 | 否 |
| `WECHAT_APP_SECRET` | 小程序 AppSecret | 微信公众平台 | `xxxxxxxxxxxxxxxx` | 是 | 否 |
| `WECHAT_MCH_ID` | 微信支付商户号 | 微信商户平台 | `16位数字` | 中 | 否 |
| `WECHAT_MCH_SERIAL_NO` | 商户证书序列号 | 微信商户平台证书信息 | `十六进制串` | 中 | 否 |
| `WECHAT_API_V3_KEY` | 微信支付 APIv3 密钥 | 微信商户平台 | `32字节字符串` | 是 | 否 |
| `WECHAT_PRIVATE_KEY_PATH` | 商户私钥路径 | 运维放置证书后确认 | `deploy/certs/apiclient_key.pem` | 是（路径本身可公开，文件敏感） | 否 |
| `WECHAT_PLATFORM_CERT_PATH` | 微信支付平台证书路径 | 运维放置证书后确认 | `deploy/certs/wechatpay_platform.pem` | 中 | 否 |
| `WECHAT_PLATFORM_CERT_SERIAL_NO` | 平台证书序列号 | 微信商户平台/证书内容 | `十六进制串` | 中 | 否 |
| `WECHAT_NOTIFY_URL` | 支付回调地址 | 运维/后端约定 | `https://api.xxx.com/api/weapp/pay/callback` | 否 | 否 |
| `WECHAT_REFUND_NOTIFY_URL` | 退款回调地址 | 运维/后端约定 | `https://api.xxx.com/api/weapp/pay/refund-callback` | 否 | 否 |
| `CORS_ORIGINS` | 后台跨域白名单 | 运维域名配置 | `https://admin.xxx.com` | 否 | 否 |
| `ADMIN_DEFAULT_PASSWORD` | 初始管理员密码 | 运维生成 | `XyMall@2026!Admin` | 是 | 否 |
| `SSL_FULLCHAIN_PATH` | HTTPS 证书链路径 | 运维证书部署 | `deploy/nginx/ssl/fullchain.pem` | 中 | 否 |
| `SSL_PRIVKEY_PATH` | HTTPS 私钥路径 | 运维证书部署 | `deploy/nginx/ssl/privkey.pem` | 是（路径本身可公开，文件敏感） | 否 |

## 3. 建议同步填写字段（运行配置）

| 字段 | 含义 | 从哪里获取 | 示例格式 | 是否敏感 | 是否可提交 Git |
|---|---|---|---|---|---|
| `API_PREFIX` | API 路由前缀 | 后端约定 | `api` | 否 | 否 |
| `LOG_LEVEL` | 日志级别 | 运维约定 | `info` | 否 | 否 |
| `DB_HOST` | 数据库主机 | 运维部署信息 | `mysql` | 否 | 否 |
| `DB_PORT` | 数据库端口 | 运维部署信息 | `3306` | 否 | 否 |
| `DB_NAME` | 数据库名称 | DBA/运维 | `baby_mall` | 否 | 否 |
| `DB_USER` | 数据库用户名 | DBA/运维 | `root` | 中 | 否 |
| `REDIS_PORT` | Redis 端口 | 运维部署信息 | `6379` | 否 | 否 |
| `JWT_EXPIRES_IN` | 用户令牌过期时间 | 后端约定 | `7d` | 否 | 否 |
| `JWT_ADMIN_EXPIRES_IN` | 后台令牌过期时间 | 后端约定 | `2h` | 否 | 否 |
| `REFRESH_TOKEN_EXPIRES_IN` | 刷新令牌过期时间 | 后端约定 | `30d` | 否 | 否 |
| `WECHAT_SKIP_VERIFY` | 是否跳过微信回调验签 | 后端约定（生产应 `false`） | `false` | 否 | 否 |
| `ADMIN_DEFAULT_USERNAME` | 初始管理员用户名 | 运维约定 | `admin` | 中 | 否 |
| `SMOKE_TEST_BYPASS_CAPTCHA` | 冒烟测试验证码开关 | 测试约定 | `false` | 中 | 否 |
| `UPLOAD_DIR` | 上传目录 | 运维约定 | `/app/apps/api/uploads` | 否 | 否 |
| `UPLOAD_MAX_SIZE` | 上传大小上限（字节） | 后端约定 | `10485760` | 否 | 否 |
| `UPLOAD_ALLOWED_TYPES` | 允许上传 MIME 列表 | 后端约定 | `image/jpeg,image/png,...` | 否 | 否 |
| `UPLOAD_PUBLIC_URL` | 上传资源公网地址 | 运维域名配置 | `https://api.xxx.com/uploads` | 否 | 否 |
| `ORDER_AUTO_CLOSE_MINUTES` | 未支付自动关闭分钟数 | 业务运营约定 | `30` | 否 | 否 |
| `ORDER_AUTO_COMPLETE_DAYS` | 自动确认收货天数 | 业务运营约定 | `15` | 否 | 否 |
| `FREIGHT_FREE_AMOUNT` | 包邮门槛 | 运营定价规则 | `99` | 否 | 否 |
| `FREIGHT_DEFAULT_FEE` | 默认运费 | 运营定价规则 | `10` | 否 | 否 |
| `FREIGHT_REMOTE_FEE` | 偏远地区运费 | 运营定价规则 | `20` | 否 | 否 |
| `POINTS_DEDUCT_RATE` | 积分抵扣比例 | 运营规则 | `100` | 否 | 否 |
| `POINTS_DEDUCT_MAX_PERCENT` | 积分抵扣上限百分比 | 运营规则 | `30` | 否 | 否 |

## 4. 填写完成后的检查

1. 运行：`pnpm release:check`
2. 严格门禁：`pnpm release:check:prod`
3. 部署前检查：`ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh`
