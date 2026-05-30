# 禧孕优选 服务器部署命令清单（可复制执行）

默认约定：除“首次克隆代码”外，以下命令默认在 `xiyunxiaochengxu` 仓库根目录执行（`package.json` 所在目录）。  
真实密钥、证书、`.env.production` 仅保留在服务器本地，严禁提交 Git。

当前状态（2026-05-31 +08:00）：本地默认门禁已通过，代码可进入预生产部署；以下服务器命令仍需在真实服务器、真实 `.env.production`、真实证书和目标数据库环境中执行。未实际执行前，不得在验收记录中标为通过。

## 1. 登录服务器后的基础检查

```bash
pwd
whoami
lsb_release -a || cat /etc/os-release
docker --version
docker compose version
git --version
```

## 2. 首次拉取代码

```bash
git clone https://github.com/kHuner9712/xiyunxiaochengxu.git
cd xiyunxiaochengxu
test -f package.json || { echo "未找到 package.json，请确认仓库目录"; exit 1; }
git status
git pull --ff-only
```

## 3. 创建私有环境文件

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

提示：真实值只填在服务器本地 `.env.production`，不提交 Git。

## 4. 创建证书目录并设置权限

```bash
mkdir -p deploy/certs deploy/nginx/ssl
chmod 700 deploy/certs deploy/nginx/ssl
```

放置文件（由运维手工上传）：

1. `deploy/certs/apiclient_key.pem`
2. `deploy/certs/wechatpay_platform.pem`
3. `deploy/nginx/ssl/fullchain.pem`
4. `deploy/nginx/ssl/privkey.pem`

说明：
1. 上述是宿主机放置路径。
2. API 容器内读取路径固定为：
- `/app/apps/api/certs/apiclient_key.pem`
- `/app/apps/api/certs/wechatpay_platform.pem`
3. `.env.production` 中 `WECHAT_PRIVATE_KEY_PATH` 与 `WECHAT_PLATFORM_CERT_PATH` 必须填写容器内路径，不要填宿主机路径。

私钥类文件权限：

```bash
chmod 600 deploy/certs/apiclient_key.pem
chmod 600 deploy/nginx/ssl/privkey.pem
```

## 5. DNS 检查

```bash
nslookup api.yunxixiaochengxu.com.cn
nslookup admin.yunxixiaochengxu.com.cn
```

## 6. Release Gate

```bash
pnpm install
pnpm release:check
pnpm release:check:prod
```

说明：

1. `pnpm release:check` 是默认门禁，允许开发占位项以 WARN 形式存在。
2. `pnpm release:check:prod` 是生产严格门禁，只有真实 AppID、生产 API 地址、协议联系方式、密钥和证书配置完成后才能作为正式发布依据。
3. 在未提供真实 AppID 或 `legal.ts` 最终联系方式前，`pnpm release:check:prod` 失败是**正确阻断**。

## 7. Docker 配置检查

```bash
cd deploy
docker compose --env-file ../.env.production config
```

## 8. 预生产启动

```bash
ENV_FILE=../.env.production bash scripts/deploy-prod-check.sh
```

## 9. 数据库迁移

返回仓库根目录后执行。执行前必须确认 `.env.production` 或当前环境变量连接的是目标预生产/生产数据库，且已完成数据库备份。

```bash
cd ..
pnpm --filter @baby-mall/api prisma migrate deploy
```

说明：本命令未连接真实目标数据库执行前，只能记录为“待核验”，不得写为通过。

## 10. 查看日志

```bash
cd deploy
docker compose --env-file ../.env.production ps
docker compose --env-file ../.env.production logs -f api
docker compose --env-file ../.env.production logs -f nginx
```

## 11. 健康检查

```bash
curl -I https://api.yunxixiaochengxu.com.cn/api/health
curl -I https://admin.yunxixiaochengxu.com.cn
curl -I https://api.yunxixiaochengxu.com.cn/uploads/
```

## 12. 冒烟测试与真机验收

```bash
cd ..
pnpm smoke
pnpm smoke:public
pnpm smoke:login
pnpm smoke:all
```

完成服务器冒烟后，再使用微信开发者工具上传体验版，并按以下文档执行人工真机验收：

1. `docs/PREPROD_ACCEPTANCE_RECORD.md`
2. `docs/MANUAL_ACCEPTANCE_CHECKLIST.md`

## 13. 回滚

```bash
git log --oneline -5
git checkout <上一稳定commit或tag>
cd deploy
docker compose --env-file ../.env.production down
docker compose --env-file ../.env.production up -d --build
```

提醒：数据库迁移回滚必须先备份，不允许随意回滚 migration。
