# 预生产部署 Runbook（禧孕优选）

## 1. 服务器准备

1. 准备 Linux 服务器（推荐 Ubuntu 22.04+），开放 80/443。
2. 安装 Docker 与 Docker Compose。
3. 准备域名并解析：
- `api.yunxixiaochengxu.com.cn` -> `62.234.69.19`
- `admin.yunxixiaochengxu.com.cn` -> `62.234.69.19`

## 2. 环境变量填写

1. 在项目根目录创建 `.env.production`（仅服务器本地保留）。
2. 按 `.env.example` 填写生产值，不得使用默认弱口令。
3. 关键项必须填写：数据库、Redis、JWT、刷新令牌、微信支付、CORS、后台默认密码。
4. 运营/资质项参考 `docs/OPERATOR_REQUIRED.md`。

## 3. 证书放置

1. 微信支付证书（仅服务器）：
- `WECHAT_PRIVATE_KEY_PATH` 指向 `apiclient_key.pem`
- `WECHAT_PLATFORM_CERT_PATH` 指向 `wechatpay_platform.pem`
2. HTTPS 证书：
- `deploy/nginx/ssl/fullchain.pem`
- `deploy/nginx/ssl/privkey.pem`
3. 确认证书文件具备可读权限。

## 4. Docker 启动前检查

```bash
pnpm release:check
pnpm release:check:prod
cd deploy
docker compose --env-file ../.env.production config
```

如需一键执行部署前检查与启动：

```bash
ENV_FILE=../.env.production bash deploy/scripts/deploy-prod-check.sh
```

## 5. 数据库迁移

```bash
cd deploy
docker compose --env-file ../.env.production run --rm api pnpm --filter @baby-mall/api prisma:migrate:deploy
```

## 6. 启动服务

```bash
cd deploy
docker compose --env-file ../.env.production up -d
```

## 7. 健康检查

1. API：`https://api.yunxixiaochengxu.com.cn/api/health`
2. 后台首页：`https://admin.yunxixiaochengxu.com.cn`
3. 上传静态资源路由：`https://api.yunxixiaochengxu.com.cn/uploads/`
4. 容器日志：`docker compose logs -f api nginx`

## 8. 回滚

1. 代码回滚到上一稳定 commit/tag。
2. 停止并重启旧版本镜像：
```bash
docker compose down
docker compose up -d
```
3. 数据库回滚前必须先备份；优先使用前向修复，谨慎执行迁移回滚。

## 9. 常见问题

1. `release:check:prod` 因 AppID 失败：未提供真实 `VITE_WX_APPID`。
2. API 启动失败：检查 `.env.production` 是否缺必填变量或存在弱密钥。
3. 支付回调验签失败：检查微信平台证书路径/序列号是否匹配。
4. 退款状态异常：在后台对账中心执行退款同步并查看业务事件。
5. 后台白屏/404：检查 `admin` 静态资源挂载与 Nginx 路由。
