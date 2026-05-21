# 服务器部署 Runbook

生成时间：2026-05-22

---

## 一、服务器部署目录结构

```
/opt/baby-mall/                    # 部署根目录
├── deploy/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── scripts/
│   │   ├── entrypoint.sh
│   │   └── redis-entrypoint.sh
│   ├── certs/
│   │   ├── .gitkeep
│   │   ├── apiclient_key.pem      # 商户私钥（手动放置）
│   │   └── wechatpay_platform.pem # 平台证书（手动放置）
│   ├── nginx/
│   │   ├── conf.d/default.conf
│   │   └── ssl/                   # SSL 证书（手动放置）
│   │       ├── fullchain.pem
│   │       └── privkey.pem
│   └── redis/
│       └── redis.conf
├── scripts/
│   └── runtime-smoke-test.sh
├── .env                           # 生产环境变量（手动创建）
└── ...
```

---

## 二、.env 必填项

创建 `/opt/baby-mall/.env`：

```bash
# 数据库
DB_PASSWORD=<强密码>
DB_NAME=baby_mall

# Redis
REDIS_PASSWORD=<强密码>

# JWT
JWT_SECRET=<随机长字符串>

# 微信小程序
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...

# 微信支付
WECHAT_MCH_ID=...
WECHAT_MCH_SERIAL_NO=...
WECHAT_API_V3_KEY=<32字节密钥>
WECHAT_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem
WECHAT_PLATFORM_CERT_PATH=/app/certs/wechatpay_platform.pem
WECHAT_PLATFORM_CERT_SERIAL_NO=...
WECHAT_NOTIFY_URL=https://你的域名.com/api/weapp/pay/callback

# 管理员
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=<强密码，至少12位，含大小写字母+数字+特殊字符>

# 环境
NODE_ENV=production
RUN_SEED=false
```

---

## 三、deploy/certs 放置证书

```bash
# 1. 从微信商户后台下载商户私钥
cp apiclient_key.pem /opt/baby-mall/deploy/certs/

# 2. 从微信支付平台下载平台证书
cp wechatpay_platform.pem /opt/baby-mall/deploy/certs/

# 3. 确认文件存在
ls -la /opt/baby-mall/deploy/certs/
# 应该看到:
# apiclient_key.pem
# wechatpay_platform.pem
```

---

## 四、deploy/nginx/ssl 放置 SSL 证书

```bash
mkdir -p /opt/baby-mall/deploy/nginx/ssl
cp fullchain.pem /opt/baby-mall/deploy/nginx/ssl/
cp privkey.pem /opt/baby-mall/deploy/nginx/ssl/
```

---

## 五、docker compose build

```bash
cd /opt/baby-mall
docker compose -f deploy/docker-compose.yml build
```

---

## 六、首次部署

```bash
cd /opt/baby-mall

# 首次部署：启动服务 + 执行 seed
RUN_SEED=true docker compose -f deploy/docker-compose.yml up -d

# 查看启动日志
docker logs baby-mall-api -f

# 等待所有服务健康
docker compose -f deploy/docker-compose.yml ps
```

---

## 七、后续更新部署

```bash
cd /opt/baby-mall

# 拉取最新代码
git pull origin main

# 重新构建并启动（migrate deploy 自动执行）
docker compose -f deploy/docker-compose.yml up -d --build

# 查看日志
docker logs baby-mall-api -f
```

---

## 八、查看日志

```bash
# API 日志
docker logs baby-mall-api -f --tail 100

# MySQL 日志
docker logs baby-mall-mysql -f --tail 50

# Redis 日志
docker logs baby-mall-redis -f --tail 50

# Nginx 日志
docker logs baby-mall-nginx -f --tail 50

# 所有服务状态
docker compose -f deploy/docker-compose.yml ps
```

---

## 九、执行 runtime-smoke-test.sh

```bash
# 开发/测试环境（支持验证码绕过）
SMOKE_TEST_BYPASS_CAPTCHA=true bash scripts/runtime-smoke-test.sh http://localhost:3000/api

# 生产环境（使用外部 ADMIN_TOKEN）
ADMIN_TOKEN="eyJhbGci..." bash scripts/runtime-smoke-test.sh https://你的域名.com/api

# 如果没有 ADMIN_TOKEN，管理员登录项会被 SKIP，不影响核心测试
bash scripts/runtime-smoke-test.sh https://你的域名.com/api
```

---

## 十、使用 ADMIN_TOKEN 做生产冒烟测试

```bash
# 1. 通过浏览器登录后台，从开发者工具中复制 token

# 2. 设置环境变量
export ADMIN_TOKEN="复制的token"

# 3. 执行测试
ADMIN_TOKEN=$ADMIN_TOKEN bash scripts/runtime-smoke-test.sh https://你的域名.com/api
```

---

## 十一、小程序 request 合法域名配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 开发 → 开发管理 → 开发设置 → 服务器域名
3. request 合法域名添加：`https://你的域名.com`
4. uploadFile 合法域名添加：`https://你的域名.com`
5. downloadFile 合法域名添加：`https://你的域名.com`

---

## 十二、微信支付回调 URL 配置

1. 登录 [微信商户平台](https://pay.weixin.qq.com)
2. API安全 → 回调URL
3. 设置为：`https://你的域名.com/api/weapp/pay/callback`
4. 确保域名已备案且 SSL 证书有效

---

## 十三、上线回滚方式

```bash
# 1. 查看当前运行的镜像
docker compose -f deploy/docker-compose.yml images

# 2. 回滚到上一个版本
git log --oneline -5  # 找到上一个 commit
git checkout <上一个commit-hash>

# 3. 重新构建并启动
docker compose -f deploy/docker-compose.yml up -d --build

# 4. 如果数据库有 migration，可能需要回滚
docker exec baby-mall-api npx prisma migrate resolve --rolled-back <migration_name>

# 5. 确认服务正常
docker compose -f deploy/docker-compose.yml ps
bash scripts/runtime-smoke-test.sh http://localhost:3000/api
```

---

## 十四、Docker 运行时验证

```bash
# 验证 @baby-mall/shared 可解析
docker exec baby-mall-api node -e "require('@baby-mall/shared'); console.log('shared ok')"

# 验证健康检查
curl http://localhost:3000/api/health

# 验证 Prisma 连接
docker exec baby-mall-api npx prisma db execute --stdin <<< "SELECT 1"

# 验证 Redis 连接
docker exec baby-mall-redis redis-cli -a "$REDIS_PASSWORD" ping
```

---

## 十五、常见问题排查

| 问题 | 排查命令 | 解决方案 |
|------|---------|---------|
| API 启动失败 | `docker logs baby-mall-api` | 检查 .env 配置、证书文件 |
| 数据库连接失败 | `docker exec baby-mall-mysql mysql -u root -p` | 检查 DB_PASSWORD |
| Redis 连接失败 | `docker exec baby-mall-redis redis-cli ping` | 检查 REDIS_PASSWORD |
| 支付模块不可启动 | `docker logs baby-mall-api \| grep 支付` | 检查证书路径和配置 |
| 健康检查 503 | `curl http://localhost:3000/api/health` | 检查 database/redis 状态 |
| 管理员登录失败 | 检查 ADMIN_DEFAULT_PASSWORD | 重新 seed 或修改密码 |
