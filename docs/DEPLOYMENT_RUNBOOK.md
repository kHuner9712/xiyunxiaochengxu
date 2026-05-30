# 预生产部署 Runbook（禧孕优选）

当前结论：**可进入预生产部署，不可正式发布**。  
默认约定：以下部署命令默认在仓库根目录执行（`package.json` 所在目录）。

上线前请同时执行：

1. [部署前收口清单](./DEPLOYMENT_CHECKLIST.md)
2. `pnpm release:check:prod`
3. `pnpm smoke:public`（需设置公网 URL 环境变量）

## 1. 服务器准备

1. 准备 Linux 服务器（推荐 Ubuntu 22.04+），开放 80/443。
2. 安装 Docker 与 Docker Compose。
3. 准备域名并解析：
- `api.yunxixiaochengxu.com.cn` -> `62.234.69.19`
- `admin.yunxixiaochengxu.com.cn` -> `62.234.69.19`

## 2. 环境变量填写

1. 复制模板：`cp .env.production.example .env.production`（仅服务器本地保留）。
2. 按 `.env.production.example` 填写生产值，不得使用默认弱口令。
3. 关键项必须填写：数据库、Redis、JWT、刷新令牌、微信支付、CORS、后台默认密码。
4. 运营/资质项参考 `docs/OPERATOR_REQUIRED.md`。
5. `deploy-prod-check.sh` 使用安全解析器读取 `.env.production`（仅识别 `KEY=VALUE`，不会执行 shell 代码）。
6. 如值包含空格、`#`、`$`、`&` 等特殊字符，建议使用双引号包裹。

## 3. 证书放置

1. 微信支付证书（仅服务器）：
- `WECHAT_PRIVATE_KEY_PATH` 指向 `apiclient_key.pem`
- `WECHAT_PLATFORM_CERT_PATH` 指向 `wechatpay_platform.pem`
2. HTTPS 证书：
- `deploy/nginx/ssl/fullchain.pem`
- `deploy/nginx/ssl/privkey.pem`
3. 确认证书文件具备可读权限。
4. 推荐路径与模板保持一致：`/.env.production.example` 中的证书路径字段。

## 4. Docker 启动前检查

```bash
pnpm release:check
pnpm release:check:prod
(cd deploy && docker compose --env-file ../.env.production config)
```

说明：在未提供真实 AppID 与 `legal.ts` 最终联系方式前，`pnpm release:check:prod` 失败是预期阻断，不应绕过。

如需一键执行部署前检查与启动：

```bash
ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh
```

密码/密钥强度门禁（deploy-prod-check）：
1. `DB_PASSWORD` / `REDIS_PASSWORD` / `JWT_SECRET` / `REFRESH_TOKEN_SECRET` / `ADMIN_DEFAULT_PASSWORD`
2. 至少 16 字符
3. 必须包含大小写字母、数字、特殊字符
4. 默认弱值将直接失败

## 5. 数据库迁移

```bash
(cd deploy && docker compose --env-file ../.env.production run --rm api pnpm --filter @baby-mall/api prisma:migrate:deploy)
```

## 6. 启动服务

```bash
(cd deploy && docker compose --env-file ../.env.production up -d)
```

## 7. 健康检查

1. API：`https://api.yunxixiaochengxu.com.cn/api/health`
2. 后台首页：`https://admin.yunxixiaochengxu.com.cn`
3. 上传静态资源路由：`https://api.yunxixiaochengxu.com.cn/uploads/`
4. 容器日志：`docker compose logs -f api nginx`

## 8. 上传文件生产存储

1. 正式商用推荐使用对象存储 + CDN 承载上传文件，本地 `uploads` 不应作为唯一长期存储。
2. 暂未接入 OSS/COS/S3 时，必须把 `UPLOAD_DIR` 挂载到宿主机持久化卷，并纳入每日备份与恢复演练。
3. `uploads` 目录权限建议仅 API 进程可写，Nginx 只读访问；禁止在该目录放置脚本、密钥、证书。
4. 保持 `UPLOAD_MAX_SIZE` 与 API 上传校验一致，Nginx `client_max_body_size` 不得低于业务上限。
5. `/uploads/` 公开访问仅适合商品图、内容图等公开资源。营业执照、食品资质等敏感资质图片如需上传，应优先走私有对象存储或后台鉴权访问；如暂时公开，运营必须知晓可被 URL 访问的风险。
6. 对象存储接入时只在私有环境变量中配置访问密钥，不得提交任何云厂商密钥到仓库。

## 9. 错误响应与可观测性

1. API 继续采用 HTTP 200 + 业务 `code` 响应模式，前端按业务 `code` 判断成功、登录过期、参数错误等。
2. 响应头与响应体会带 `requestId`，也支持客户端传入 `X-Request-Id` 或 `X-Correlation-Id`。
3. 排查线上问题时，先用 `requestId` 关联网关日志、API 日志与 BusinessEvent。
4. 支付、退款、库存、补偿任务异常应优先查看后台业务事件表，再查看容器日志。

## 10. 回滚

1. 代码回滚到上一稳定 commit/tag。
2. 停止并重启旧版本镜像：
```bash
(cd deploy && docker compose down && docker compose up -d)
```
3. 数据库回滚前必须先备份；优先使用前向修复，谨慎执行迁移回滚。

## 11. 常见问题

1. `release:check:prod` 因 AppID 失败：未提供真实 `VITE_WX_APPID`。
2. API 启动失败：检查 `.env.production` 是否缺必填变量或存在弱密钥。
3. 支付回调验签失败：检查微信平台证书路径/序列号是否匹配。
4. 退款状态异常：在后台对账中心执行退款同步并查看业务事件。
5. 后台白屏/404：检查 `admin` 静态资源挂载与 Nginx 路由。
