# 禧孕优选 服务器部署命令清单（可复制执行）

默认约定：除“首次克隆代码”外，以下命令默认在 `xiyunxiaochengxu` 仓库根目录执行（`package.json` 所在目录）。  
真实密钥、证书、`.env.production` 仅保留在服务器本地，严禁提交 Git。

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

说明：在未提供真实 AppID 或 `legal.ts` 最终联系方式前，`pnpm release:check:prod` 失败是**正确阻断**。

## 7. Docker 配置检查

```bash
cd deploy
docker compose --env-file ../.env.production config
```

## 8. 预生产启动

```bash
ENV_FILE=../.env.production bash scripts/deploy-prod-check.sh
```

## 9. 查看日志

```bash
docker compose --env-file ../.env.production ps
docker compose --env-file ../.env.production logs -f api
docker compose --env-file ../.env.production logs -f nginx
```

## 10. 健康检查

```bash
curl -I https://api.yunxixiaochengxu.com.cn/api/health
curl -I https://admin.yunxixiaochengxu.com.cn
curl -I https://api.yunxixiaochengxu.com.cn/uploads/
```

## 11. 回滚

```bash
git log --oneline -5
git checkout <上一稳定commit或tag>
cd deploy
docker compose --env-file ../.env.production down
docker compose --env-file ../.env.production up -d --build
```

提醒：数据库迁移回滚必须先备份，不允许随意回滚 migration。
