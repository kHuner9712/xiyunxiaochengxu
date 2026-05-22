# 服务器部署 Runbook

生成时间：2026-05-22
最后更新：2026-05-22

---

## 一、服务器部署目录结构

```
/opt/baby-mall/                    # 部署根目录
├── baby-mall/                     # 代码仓库
│   ├── apps/
│   │   ├── api/                   # NestJS 后端
│   │   ├── admin-web/             # Vue3 管理后台
│   │   └── miniprogram/           # uni-app 小程序
│   ├── packages/
│   │   └── shared/                # 共享包
│   ├── deploy/
│   │   ├── docker-compose.yml     # Docker Compose 配置
│   │   ├── Dockerfile.api         # API 镜像构建
│   │   ├── certs/                 # 微信支付证书（bind mount）
│   │   │   ├── .gitkeep
│   │   │   ├── README.md
│   │   │   ├── apiclient_key.pem  # 商户私钥（不提交 Git）
│   │   │   └── wechatpay_platform.pem  # 平台证书（不提交 Git）
│   │   ├── mysql/
│   │   │   ├── my.cnf
│   │   │   └── init.sql
│   │   ├── nginx/
│   │   │   ├── nginx.conf
│   │   │   ├── conf.d/
│   │   │   │   └── default.conf
│   │   │   └── ssl/              # SSL 证书
│   │   │       ├── fullchain.pem  # SSL 证书链（不提交 Git）
│   │   │       └── privkey.pem    # SSL 私钥（不提交 Git）
│   │   ├── redis/
│   │   │   └── redis.conf
│   │   └── scripts/
│   │       ├── entrypoint.sh
│   │       └── redis-entrypoint.sh
│   ├── scripts/
│   │   └── runtime-smoke-test.sh
│   ├── .env                       # 环境变量（不提交 Git）
│   └── .env.example               # 环境变量示例
```

---

## 二、.env 必填项

复制 `.env.example` 为 `.env`，然后修改以下必填项：

```env
# 数据库密码（必填，强密码）
DB_PASSWORD=<强密码>

# JWT 密钥（必填，随机长字符串）
JWT_SECRET=<随机32位以上字符串>

# 微信小程序（必填）
WECHAT_APP_ID=<你的小程序AppID>
WECHAT_APP_SECRET=<你的小程序AppSecret>

# 微信支付 V3（必填）
WECHAT_MCH_ID=<商户号>
WECHAT_MCH_SERIAL_NO=<商户证书序列号>
WECHAT_API_V3_KEY=<APIv3密钥，32字节>
WECHAT_NOTIFY_URL=https://你的域名/api/weapp/pay/callback

# 管理员账号（生产环境必填）
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=<强密码，至少12位含大小写字母+数字+特殊字符>
```

**密码规则**：
- 长度不少于 12 位
- 必须包含大写字母、小写字母、数字和特殊字符
- 不允许使用弱密码：`admin123`、`password`、`123456`、`change_this_password`
- 示例强密码：`Xiyun@2026!Prod`

---

## 三、deploy/certs 放置微信支付证书

```bash
# 将微信支付证书放到 deploy/certs/ 目录
cp /path/to/apiclient_key.pem deploy/certs/apiclient_key.pem
cp /path/to/wechatpay_platform.pem deploy/certs/wechatpay_platform.pem

# 确认文件存在
ls -la deploy/certs/
# 应该看到：
# apiclient_key.pem
# wechatpay_platform.pem

# 确认 .gitignore 已忽略 *.pem
cat .gitignore | grep "deploy/certs"
# 应该看到：deploy/certs/*.pem
```

容器内路径（Docker bind mount）：
- `deploy/certs/ → /app/apps/api/certs:ro`
- `WECHAT_PRIVATE_KEY_PATH=/app/apps/api/certs/apiclient_key.pem`
- `WECHAT_PLATFORM_CERT_PATH=/app/apps/api/certs/wechatpay_platform.pem`

---

## 四、deploy/nginx/ssl 放置 SSL 证书

```bash
# 将 SSL 证书放到 deploy/nginx/ssl/ 目录
cp /path/to/fullchain.pem deploy/nginx/ssl/fullchain.pem
cp /path/to/privkey.pem deploy/nginx/ssl/privkey.pem

# 确认文件存在
ls -la deploy/nginx/ssl/
```

---

## 五、Docker 构建与启动

```bash
# 1. 验证 docker-compose.yml 配置
docker compose -f deploy/docker-compose.yml config

# 2. 构建镜像
docker compose -f deploy/docker-compose.yml build

# 3. 启动服务
docker compose -f deploy/docker-compose.yml up -d

# 4. 查看容器状态
docker ps

# 5. 查看 API 日志
docker logs baby-mall-api --tail=200

# 6. 查看 Nginx 日志
docker logs baby-mall-nginx --tail=100
```

---

## 六、验证 @baby-mall/shared 可解析

Dockerfile.api 使用方案 A：保持 api 原始目录结构，WORKDIR 为 `/app/apps/api`。

pnpm workspace symlink `node_modules/@baby-mall/shared` 指向 `../../../packages/shared`，
在容器内解析为 `/app/packages/shared`，Dockerfile 已 COPY 到该位置。

```bash
# 验证 @baby-mall/shared 在容器内可被 require
docker exec baby-mall-api node -e "require('@baby-mall/shared'); console.log('shared ok')"
# 预期输出：shared ok
```

如果输出错误，检查：
```bash
# 检查 symlink 目标
docker exec baby-mall-api ls -la node_modules/@baby-mall/shared
# 检查 packages/shared 内容
docker exec baby-mall-api ls -la /app/packages/shared/dist/
```

---

## 七、验证数据库 migration

```bash
# 检查 admin_users 表结构（确认 must_change_password 字段存在）
docker exec baby-mall-mysql mysql -uroot -p"$DB_PASSWORD" -e "DESC baby_mall.admin_users;"

# 应该看到 must_change_password 行：
# | must_change_password | tinyint(1) | NO   |     | 0       |       |
```

---

## 八、执行 runtime-smoke-test.sh

### 开发/测试环境

```bash
SMOKE_TEST_BYPASS_CAPTCHA=true bash scripts/runtime-smoke-test.sh http://localhost:3000/api
```

### 生产环境（使用 ADMIN_TOKEN）

```bash
ADMIN_TOKEN="eyJhbGci..." IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名/api
```

### 生产环境（无 ADMIN_TOKEN）

```bash
IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名/api
```

无 ADMIN_TOKEN 时，管理员登录项标记为 SKIP，不影响核心测试通过。

### 测试结果说明

| 结果 | 含义 |
|------|------|
| PASS | 测试通过 |
| FAIL | 测试失败（核心接口失败导致 exit 1） |
| SKIP | 跳过（管理员登录在生产环境无 ADMIN_TOKEN 时跳过） |

---

## 九、生产首次登录强制改密

### 流程

1. 生产 seed 创建管理员时，`must_change_password=true`
2. 管理员登录后，返回数据中 `mustChangePassword: true`
3. 管理后台前端检测到 `mustChangePassword=true`，强制跳转到修改密码页面
4. 除修改密码页和退出登录外，不允许进入其他业务页面
5. 修改密码成功后，`mustChangePassword` 变为 `false`，跳转到 dashboard
6. 非生产环境默认不强制改密

### 验证

```bash
# 登录后检查返回值
curl -s -X POST https://你的域名/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"xxx","captchaId":"xxx","captchaCode":"xxx"}' | jq .

# 应该看到 mustChangePassword: true（首次登录时）
```

---

## 十、小程序 request 合法域名配置

在微信公众平台 → 开发管理 → 开发设置 → 服务器域名中配置：

| 类型 | 域名 |
|------|------|
| request 合法域名 | `https://你的域名` |
| uploadFile 合法域名 | `https://你的域名` |
| downloadFile 合法域名 | `https://你的域名` |

---

## 十一、微信支付回调 URL 配置

在微信支付商户平台配置：

- 回调 URL：`https://你的域名/api/weapp/pay/callback`
- 必须为 HTTPS
- 回调返回原始 JSON 格式（不被统一包装）

---

## 十二、上线回滚方式

### 方式一：代码回滚

```bash
cd /opt/baby-mall/baby-mall
git log --oneline -5          # 查看最近提交
git checkout <上一个稳定版本commit>
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d
```

### 方式二：镜像回滚

```bash
# 如果之前打了镜像 tag
docker tag baby-mall-api:previous baby-mall-api:rollback
docker compose -f deploy/docker-compose.yml up -d
```

### 方式三：数据库回滚

```bash
# 如果有数据库备份
docker exec -i baby-mall-mysql mysql -uroot -p"$DB_PASSWORD" baby_mall < backup.sql
```

---

## 十三、完整服务器实跑流程

```bash
# 1. 拉取代码
cd /opt/baby-mall
git clone https://github.com/kHuner9712/xiyunxiaochengxu.git baby-mall
cd baby-mall

# 2. 创建 .env
cp .env.example .env
vi .env  # 填写所有必填项

# 3. 放置微信支付证书
cp /path/to/apiclient_key.pem deploy/certs/apiclient_key.pem
cp /path/to/wechatpay_platform.pem deploy/certs/wechatpay_platform.pem

# 4. 放置 SSL 证书
cp /path/to/fullchain.pem deploy/nginx/ssl/fullchain.pem
cp /path/to/privkey.pem deploy/nginx/ssl/privkey.pem

# 5. 验证 docker-compose 配置
docker compose -f deploy/docker-compose.yml config

# 6. 构建镜像
docker compose -f deploy/docker-compose.yml build

# 7. 启动服务
docker compose -f deploy/docker-compose.yml up -d

# 8. 查看容器状态
docker ps

# 9. 查看 API 日志
docker logs baby-mall-api --tail=200

# 10. 查看 Nginx 日志
docker logs baby-mall-nginx --tail=100

# 11. 验证 @baby-mall/shared 可解析
docker exec baby-mall-api node -e "require('@baby-mall/shared'); console.log('shared ok')"

# 12. 验证数据库字段
docker exec baby-mall-mysql mysql -uroot -p"$DB_PASSWORD" -e "DESC baby_mall.admin_users;"

# 13. 健康检查
curl https://你的域名/api/health

# 14. 冒烟测试（无 ADMIN_TOKEN）
IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名/api

# 15. 冒烟测试（使用 ADMIN_TOKEN）
ADMIN_TOKEN="eyJhbGci..." IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名/api
```

---

## 十四、常见问题排查

| 问题 | 排查命令 | 解决方案 |
|------|---------|---------|
| API 启动失败 | `docker logs baby-mall-api` | 检查 .env 配置、数据库连接 |
| shared 解析失败 | `docker exec baby-mall-api ls -la /app/packages/shared/dist/` | 确认 Dockerfile COPY 正确 |
| 证书找不到 | `docker exec baby-mall-api ls -la /app/apps/api/certs/` | 确认 deploy/certs/ 下有 .pem 文件 |
| Redis 连接失败 | `docker exec baby-mall-redis redis-cli ping` | 检查 REDIS_PASSWORD 配置 |
| MySQL 连接失败 | `docker exec baby-mall-mysql mysqladmin ping -h localhost` | 检查 DB_PASSWORD 配置 |
| 健康检查 503 | `curl http://localhost:3000/api/health` | 检查数据库和 Redis 连接 |
| 管理员登录失败 | 检查 seed 日志 | 确认 ADMIN_DEFAULT_PASSWORD 已配置 |
