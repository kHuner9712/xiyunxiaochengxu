# 生产部署 Runbook（禧孕优选）

> 本文描述仓库当前唯一受支持的生产部署与恢复路径。**不要手工拼接 migration、Compose 启动或数据库回滚命令来替代这些入口。**

## 0. 当前原则

- 正式部署只能从远端最新 `main` 执行。
- 必须显式提供批准的完整 40 位 `EXPECTED_DEPLOY_SHA`。
- 唯一部署入口：`deploy/scripts/deploy-production.sh`。
- `deploy/scripts/deploy.sh` 与 `deploy/scripts/deploy-prod-check.sh` 仅为兼容入口，都会转发到同一安全部署脚本。
- 灾难恢复必须同时恢复**同一批次的数据库和 uploads**，使用 `deploy/scripts/restore.sh`。
- 仓库门禁通过不等于真实生产/真机验收通过。

## 1. 服务器要求

- Linux（Ubuntu 22.04+ 或同级发行版）
- Node.js `22.13.0`（仓库 CI / Docker 构建基线）
- pnpm `11.2.2`
- Docker + Docker Compose v2（`docker compose`）
- `git`、`curl`、`gzip`、`openssl`
- 公网开放 `80/443`
- MySQL、Redis、API 宿主机端口仅绑定 loopback，不对公网开放
- Redis 宿主机必须满足 `vm.overcommit_memory=1`

## 2. 固定生产域名与 TLS

当前 production preflight 与 Nginx 共同锁定：

- API：`api.yunxixiaochengxu.com.cn`
- Admin：`admin.yunxixiaochengxu.com.cn`

TLS 文件必须放在：

```text
deploy/nginx/ssl/api/fullchain.pem
deploy/nginx/ssl/api/privkey.pem
deploy/nginx/ssl/admin/fullchain.pem
deploy/nginx/ssl/admin/privkey.pem
```

部署脚本会校验证书可读、证书与私钥匹配、域名覆盖正确，且有效期至少还剩 7 天。

如需额外校验 DNS 指向当前服务器，可在部署时设置 `EXPECTED_SERVER_IP`；不要把公网 IP 写死进仓库文档或脚本。

## 3. `.env.production`

复制模板：

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

按模板填入真实值。重点包括：

- `DATABASE_URL` 与 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` 必须完全一致；密码含 URI 保留字符时要 percent-encode。
- Redis 强密码。
- `JWT_SECRET`、`REFRESH_TOKEN_SECRET`。
- 真实微信小程序 AppID/AppSecret。
- 微信支付商户号、API v3 Key、商户私钥、平台证书和序列号。
- 回调 URL 必须是固定正式 API 域名的支付/退款路径。
- `UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn`。
- `CORS_ORIGINS` 必须包含 `https://admin.yunxixiaochengxu.com.cn`。
- 首次生产库需要真实 `ADMIN_DEFAULT_USERNAME/ADMIN_DEFAULT_PASSWORD`；首次登录强制改密。

订单自动关闭、自动收货、售后期限、运费、包邮门槛、积分抵扣等**不通过 `.env.production` 配置**。它们的唯一运行时来源是数据库 `system_configs`，由管理后台“系统配置”维护；金额型配置以“分”持久化。

## 4. 证书目录

微信支付材料仅放服务器，不提交 Git：

```text
deploy/certs/apiclient_key.pem
deploy/certs/wechatpay_platform.pem
deploy/certs/wechatpay_platform_*.pem   # 轮换时可选
```

容器内对应路径：

```text
/app/apps/api/certs/apiclient_key.pem
/app/apps/api/certs/wechatpay_platform.pem
```

## 5. 合并后、部署前仓库门禁

在真正连接生产服务器前，至少确认目标 `main` SHA 的：

- CI
- Release Gate Check
- API Unit Diagnostic
- API E2E Diagnostic
- API Open Handle Diagnostic
- Production Container Bootstrap

均成功。

`Production Container Bootstrap` 会真实构建 production API 镜像，并在隔离空数据库上执行：production preflight → migrations → fresh seed → 首管理员 → Redis/MySQL health。

## 6. 唯一生产部署命令

确认本地仓库是干净的最新 `main`，然后执行：

```bash
EXPECTED_DEPLOY_SHA=<批准的完整40位main提交SHA> \
ENV_FILE=.env.production \
bash deploy/scripts/deploy-production.sh
```

该脚本会强制完成或验证：

1. Git worktree 干净、当前分支为 `main`。
2. HEAD 等于 `EXPECTED_DEPLOY_SHA`，且等于最新 `origin/main`。
3. `.env.production`、数据库连接、标准 80/443、固定域名/CORS/上传 origin/回调地址正确。
4. 微信商户私钥、平台证书与序列号正确。
5. API/Admin TLS 证书正确。
6. 构建候选 production image。
7. 候选镜像在改动 live DB 前通过完整 production preflight。
8. MySQL/Redis 健康。
9. 进入维护模式并停止公网/API writers。
10. 备份 live 数据库。
11. 把备份恢复到隔离 MySQL，使用候选镜像执行 migration/status/schema-drift 验证。
12. 只有克隆验证通过后才执行 live migration。
13. 启动候选 API并通过 health。
14. 恢复 Nginx 公网流量。
15. 执行完整 `smoke-runtime.sh`。
16. 在安全阶段失败时按脚本规则自动恢复；公网已重新开放后不会盲目回滚可能包含新写入的数据库。

**不要**绕过上述流程手工运行 `prisma migrate deploy` 后再直接 `docker compose up -d`。

## 7. 日常完整备份

数据库与本地 uploads 必须作为同一恢复单元：

```bash
ENV_FILE=.env.production bash deploy/scripts/backup.sh
```

每个批次生成：

```text
db_YYYYMMDD_HHMMSS.sql.gz
uploads_YYYYMMDD_HHMMSS.tar.gz
checksums_YYYYMMDD_HHMMSS.sha256
```

应异地保存完整三件套，并定期做恢复演练。

## 8. 灾难恢复

恢复会覆盖当前生产数据库和 uploads，必须使用同一批次：

```bash
ENV_FILE=.env.production \
bash deploy/scripts/restore.sh db_YYYYMMDD_HHMMSS.sql.gz
```

非交互执行还必须提供精确时间戳确认：

```bash
RESTORE_CONFIRM=YYYYMMDD_HHMMSS \
ENV_FILE=.env.production \
bash deploy/scripts/restore.sh db_YYYYMMDD_HHMMSS.sql.gz
```

恢复脚本会：

- 在停 writers 前验证 DB archive、uploads archive 与 checksum；
- 关闭 Nginx/API；
- 重建并恢复数据库；
- 恢复同批次 uploads；
- 启动 API 并通过 `/health`；
- 临时启动 Nginx 后执行完整 runtime smoke；
- smoke 失败会再次停止 Nginx，保持公网关闭；
- 只有完整 smoke 成功才报告恢复完成。

## 9. 私有上传规则

- 仅 `/uploads/public/...` 可静态公开。
- `/uploads/private/...` 和兜底 `/uploads/...` 不允许直接静态访问。
- 售后图片、营业执照、商品资质等私有文件必须通过后端鉴权接口读取。
- 当前本地 uploads 使用 Docker 持久卷；如果未来切换对象存储，仍需保持私有/公开语义一致。

## 10. 真机/真实平台验收（部署之后单独进行）

生产 smoke 不能替代：

- 微信真实登录与手机号能力；
- 合法 request/upload/download 域名；
- 原生微信客服；
- 真实微信支付与支付回调；
- 真实退款与退款回调；
- 登录 → 浏览 → 领券 → 普通/促销下单 → 支付 → 履约/核销 → 售后 → 退款 → 客服完整链。

只有服务器 production gate 与上述真机链均通过，才可进入正式发布判断。
