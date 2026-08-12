# 部署前收口清单（Go/No-Go）

适用阶段：**合并到 `main` 后、连接真实服务器前**。本清单通过只代表可以进入服务器 production gate，不代表已经可以正式发布。

## 1. 仓库版本

- [ ] 当前目标版本是远端最新 `main`。
- [ ] 已记录完整 40 位 commit SHA，后续作为 `EXPECTED_DEPLOY_SHA`。
- [ ] Git worktree 干净。
- [ ] 该 SHA 的 CI、Release Gate、API Unit、API E2E、Open Handle 全部成功。
- [ ] `Production Container Bootstrap` 成功，确认 production Docker 镜像可在空库完成 preflight → migration → fresh seed → health。

## 2. 服务器与网络

- [ ] Linux（建议 Ubuntu 22.04+）。
- [ ] Docker + Docker Compose v2 可用。
- [ ] `git`、`curl`、`gzip`、`openssl` 可用。
- [ ] 公网 `80/443` 开放。
- [ ] MySQL、Redis、API 宿主机端口只绑定 loopback，不直接暴露公网。
- [ ] `vm.overcommit_memory=1`。
- [ ] 磁盘空间能够同时容纳当前数据库、上传文件、候选镜像与至少一份完整备份。

## 3. 固定域名与 TLS

当前 production contract 固定为：

- API：`api.yunxixiaochengxu.com.cn`
- Admin：`admin.yunxixiaochengxu.com.cn`

- [ ] 两个域名 DNS 已指向当前服务器/负载均衡。
- [ ] API 证书：`deploy/nginx/ssl/api/fullchain.pem`
- [ ] API 私钥：`deploy/nginx/ssl/api/privkey.pem`
- [ ] Admin 证书：`deploy/nginx/ssl/admin/fullchain.pem`
- [ ] Admin 私钥：`deploy/nginx/ssl/admin/privkey.pem`
- [ ] 证书覆盖对应域名、证书/私钥匹配且有效期充足。

不要使用旧路径 `deploy/nginx/ssl/fullchain.pem` / `privkey.pem`。

## 4. 微信平台

- [ ] 真实小程序 AppID/AppSecret。
- [ ] request 合法域名：`https://api.yunxixiaochengxu.com.cn`
- [ ] uploadFile 合法域名：同上。
- [ ] downloadFile 合法域名：同上。
- [ ] 真实微信支付商户号。
- [ ] API v3 Key（32 字节）。
- [ ] 商户私钥：宿主机 `deploy/certs/apiclient_key.pem`。
- [ ] 平台证书：宿主机 `deploy/certs/wechatpay_platform.pem`。
- [ ] 平台证书序列号与证书一致。
- [ ] 支付回调：`https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback`
- [ ] 退款回调：`https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback`

## 5. `.env.production`

- [ ] 从 `.env.production.example` 复制，权限 `chmod 600`。
- [ ] `DATABASE_URL` 与 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` 一致。
- [ ] 数据库密码中 URI 保留字符已在 `DATABASE_URL` 内 percent-encode。
- [ ] Redis 强密码。
- [ ] JWT / Refresh Token 强密钥。
- [ ] `UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn`
- [ ] `CORS_ORIGINS` 包含 `https://admin.yunxixiaochengxu.com.cn`
- [ ] `HTTP_HOST_PORT=80`
- [ ] `HTTPS_HOST_PORT=443`
- [ ] `SMOKE_TEST_BYPASS_CAPTCHA=false`
- [ ] `WECHAT_SKIP_VERIFY=false`
- [ ] 首次生产库的 `ADMIN_DEFAULT_USERNAME/ADMIN_DEFAULT_PASSWORD` 已设置为真实强凭据。

订单自动关闭、自动收货、售后期限、运费、包邮门槛和积分抵扣**不要在 `.env.production` 配置**；这些值由后台“系统配置”写入 `system_configs`。

## 6. 上传与备份

- [ ] 公开静态路径只有 `/uploads/public/...`。
- [ ] `/uploads/private/...` 不可直接静态访问。
- [ ] 售后图片、营业执照、商品资质等通过后端鉴权读取。
- [ ] uploads 使用持久卷。
- [ ] 已验证 `deploy/scripts/backup.sh` 可生成同批次 DB + uploads + checksum 三件套。
- [ ] 已准备异地备份位置。
- [ ] 已演练 `deploy/scripts/restore.sh`，确认失败时公网保持关闭。

## 7. 唯一部署入口

正式部署只允许：

```bash
EXPECTED_DEPLOY_SHA=<批准的完整40位main提交SHA> \
ENV_FILE=.env.production \
bash deploy/scripts/deploy-production.sh
```

- [ ] 不手工执行 live `prisma migrate deploy` 后直接 `docker compose up`。
- [ ] 不使用旧版 `deploy.sh` 逻辑绕过门禁；该文件现在只做安全转发。
- [ ] 不直接编辑 Nginx server_name 试图切换其他域名；当前 preflight 会拒绝域名漂移。

## 8. 部署脚本必须自动完成

- [ ] 校验 exact main SHA。
- [ ] production config preflight。
- [ ] 微信支付证书与 TLS 证书校验。
- [ ] 构建候选 production image。
- [ ] 停止公网/API writers 前后按脚本的维护模式顺序执行。
- [ ] live DB 备份。
- [ ] 备份克隆到隔离 MySQL 并执行 migration/status/schema drift。
- [ ] clone 验证通过后才碰 live migration。
- [ ] 候选 API health 成功后才恢复 Nginx。
- [ ] 最终 `smoke-runtime.sh` 成功。

任何一步失败时，不允许为了“继续上线”手工跳过失败门禁。

## 9. 管理后台部署后检查

- [ ] `https://admin.yunxixiaochengxu.com.cn/` 可访问。
- [ ] 首次管理员登录强制改密。
- [ ] 商品/订单/售后/自提/结算等菜单与角色权限一致。
- [ ] 系统配置中的金额 UI 以“元”显示，数据库以“分”持久化。

## 10. 小程序体验版与真机

服务器 production gate 全部通过后再进行：

- [ ] `VITE_WX_APPID=<真实AppID> VITE_API_BASE_URL=https://api.yunxixiaochengxu.com.cn/api pnpm build:mini:prod`
- [ ] 微信开发者工具上传体验版。
- [ ] 真机登录/手机号。
- [ ] 商品浏览、购物车、领券。
- [ ] 普通单、秒杀、拼团/活动下单。
- [ ] 微信支付、支付回调、后端状态确认。
- [ ] 发货/自提/权益核销。
- [ ] 售后、退款、退款回调。
- [ ] 客服。

## 11. 灾难恢复入口

只使用完整备份批次：

```bash
ENV_FILE=.env.production \
bash deploy/scripts/restore.sh db_YYYYMMDD_HHMMSS.sql.gz
```

必须同时存在：

- `db_YYYYMMDD_HHMMSS.sql.gz`
- `uploads_YYYYMMDD_HHMMSS.tar.gz`
- `checksums_YYYYMMDD_HHMMSS.sha256`

恢复脚本只有在 API health + 完整 runtime smoke 都通过后才报告成功；失败会停止 Nginx，保持公网关闭。
