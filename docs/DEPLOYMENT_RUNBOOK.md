# 生产部署 Runbook（禧孕优选）

本 Runbook 只描述当前仓库**唯一允许的生产发布、备份与恢复路径**。禁止用手工 `docker compose up`、手工 `prisma migrate deploy`、旧 `deploy.sh` 独立逻辑或其他旁路替代正式部署脚本。

> 仓库门禁通过只代表代码候选可进入服务器生产门禁；服务器、微信平台和真机验收仍必须逐项完成后才能正式发布。

## 1. 工具与主机前提

- Node.js：`>=22.13.0 <25`；CI 基线为 `22.13.0`。
- pnpm：`11.2.2`。
- Docker + Docker Compose v2（命令为 `docker compose`）。
- Linux 主机必须满足 Redis 启动前提：`vm.overcommit_memory=1`。Redis entrypoint 会 fail-closed 校验；THP 未关闭时会告警。
- 公网只开放 80/443；MySQL、Redis、API 宿主机端口只绑定回环地址。
- 正式域名固定为：
  - `api.yunxixiaochengxu.com.cn`
  - `admin.yunxixiaochengxu.com.cn`

不要把历史服务器 IP 写入运行手册；部署前以 DNS 实际解析和目标主机为准。

## 2. 生产环境文件

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

按 `.env.production.example` 填写真实值。重点规则：

- `DATABASE_URL` 必须与 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` 完全一致；密码含 URI 保留字符时必须 percent-encode。
- `HTTP_HOST_PORT=80`、`HTTPS_HOST_PORT=443`。
- 回调、CORS、上传公网基址必须使用仓库规定的正式域名。
- DB/Redis 必须使用独立强随机密码；当前自动门禁负责必填、拒绝模板占位值和数据库连接串一致性。JWT/Refresh secret 还会强制至少 32 字符并拒绝弱值，后台初始密码会强制至少 12 字符并拒绝弱值。
- 微信商户私钥和平台证书必须是真实可解析文件；平台证书序列号必须匹配。
- `WECHAT_SKIP_VERIFY=false`，`SMOKE_TEST_BYPASS_CAPTCHA=false`。
- 订单自动关单/自动收货、售后期限、包邮门槛、默认运费、积分抵扣等**可变业务参数由数据库 `system_configs` 与后台“系统配置”控制，不由生产 env 控制**。

## 3. 证书目录

### 微信支付证书（宿主机，不进 Git）

- `deploy/certs/apiclient_key.pem`
- `deploy/certs/wechatpay_platform.pem`
- 平台证书轮换时可放 `deploy/certs/wechatpay_platform_*.pem`

API 容器内路径：

- `/app/apps/api/certs/apiclient_key.pem`
- `/app/apps/api/certs/wechatpay_platform.pem`

### HTTPS 证书（宿主机，不进 Git）

API 域名：

- `deploy/nginx/ssl/api/fullchain.pem`
- `deploy/nginx/ssl/api/privkey.pem`

Admin 域名：

- `deploy/nginx/ssl/admin/fullchain.pem`
- `deploy/nginx/ssl/admin/privkey.pem`

## 4. 发布候选身份

生产发布必须从最新 `main` 执行，并把经过批准的**完整 40 位 main SHA**传给脚本：

```bash
git fetch origin main
MAIN_SHA="$(git rev-parse origin/main)"
git checkout main
git reset --hard "$MAIN_SHA"
```

确认该 SHA 的仓库门禁均已通过后，才进入服务器发布命令。

## 5. 唯一生产部署入口

```bash
EXPECTED_DEPLOY_SHA="$MAIN_SHA" \
ENV_FILE=.env.production \
bash deploy/scripts/deploy-production.sh
```

`deploy/scripts/deploy-prod-check.sh` 与 `deploy/scripts/deploy.sh` 仅是兼容入口，必须最终 `exec` 到同一个 `deploy-production.sh`；不得存在第二套部署实现。

正式部署脚本会 fail-closed 完成以下关键步骤：

1. 校验当前分支、当前 HEAD、`origin/main` 与 `EXPECTED_DEPLOY_SHA` 完全一致。
2. 校验生产配置、证书、域名、端口与运行时契约。
3. 构建候选镜像。
4. 进入维护窗口，停止公网与 API/background writers。
5. 取得数据库备份。
6. 在隔离 MySQL 克隆上真实执行 migration、migration status 与 schema drift 检查。
7. 通过后才迁移 live DB。
8. 启动候选 API，验证 health / build SHA / 关键业务路由。
9. Nginx 配置通过后开放公网。
10. 执行完整 runtime smoke；失败按脚本 fail-closed/回滚策略处理。

**禁止**绕过脚本直接执行生产 `prisma migrate deploy` 或 `docker compose up -d`。

## 6. Fresh database 首次启动

无需手工设置 `RUN_SEED=true`。

生产 entrypoint 会：

1. 先执行 production preflight。
2. 执行 `prisma migrate deploy`。
3. 查询真实 `admin_users` 数量。
4. 仅当管理员数量为 0 时自动执行生产 seed。
5. Fresh bootstrap 会创建首管理员并要求首次登录改密，同时把客服初始模式收口到可用的微信客服模式。
6. 已存在管理员的生产库不会被自动重复 seed。

## 7. 备份

独立一致性备份入口：

```bash
ENV_FILE=.env.production bash deploy/scripts/backup.sh
```

备份必须形成同一时间戳的完整三件套：

- `db_<timestamp>.sql.gz`
- `uploads_<timestamp>.tar.gz`
- `checksums_<timestamp>.sha256`

脚本会先停止公网和 API/background writers，使数据库与 uploads 来自同一维护窗口，再恢复备份前运行状态。不得只备份数据库而忽略本地持久化 uploads。

## 8. 灾难恢复

先列出完整备份集：

```bash
ENV_FILE=.env.production bash deploy/scripts/restore.sh
```

恢复指定备份：

```bash
ENV_FILE=.env.production bash deploy/scripts/restore.sh YYYYMMDD_HHMMSS
```

恢复脚本必须：

- 校验 DB、uploads、checksum 同批次完整存在且 SHA256 正确；
- 停止公网和 API/background writers；
- 在可行时先创建恢复前救援快照；
- 重建目标数据库后恢复 dump；
- 清理并恢复同批次 uploads；
- 将恢复数据迁移到当前代码 schema；
- API health 通过后才启动 Nginx；
- full runtime smoke 通过后才报告恢复成功；
- 破坏性恢复中途失败时保持 API/Nginx 关闭。

禁止使用旧 `docker-compose`、硬编码数据库密码或“只恢复 SQL”的手工流程。

## 9. 上传访问边界

Nginx 当前契约：

- `/uploads/public/...`：允许公开静态读取。
- `/uploads/private/...`：403。
- 其他 `/uploads/...`：403。
- 私有售后图片、营业执照、食品/经营资质等必须通过后端鉴权文件接口访问，不能通过静态 URL 暴露。

API 与 Nginx 使用同一个持久化 `upload_data` 卷；Nginx 只读挂载。

## 10. 微信平台与真机验收

服务器 runtime smoke 通过后仍需人工确认：

- 微信公众平台 request/uploadFile/downloadFile 合法域名均为正式 API HTTPS 域名。
- 支付回调：`https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback`。
- 退款回调：`https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback`。
- TLS 证书链公网可信。
- 真实小程序生产构建使用真实 AppID 与 `https://api.yunxixiaochengxu.com.cn/api`。
- 真机完整链：登录 → 浏览/优惠券 → 普通/活动订单 → 微信支付 → 回调 → 履约/自提 → 售后 → 退款 → 退款回调 → 客服。

## 11. 回滚原则

不要使用 `docker compose down && up -d` 作为“回滚方案”。

- 代码发布失败：由 audited deployment flow 使用明确的已批准版本与已知数据库状态处理。
- 涉及数据恢复：使用 `restore.sh` 的完整 DB + uploads 恢复契约。
- 能前向修复 migration 时优先前向修复，禁止随意手工逆向 SQL。
- 任何恢复后必须重新通过 API health、Nginx 检查与 full runtime smoke。

## 12. Go / No-Go

只有以下全部满足才可以从仓库/服务器门禁进入真机验收：

- 目标 `main` SHA 唯一且未发生漂移。
- 目标 SHA 的 CI / Release Gate /诊断门禁全部成功。
- production preflight 成功。
- migration clone rehearsal 成功。
- live API/Nginx health 成功。
- full runtime smoke 成功。
- 备份与恢复路径可执行。

真机验收完成前仍不能视为正式生产验收完成。
