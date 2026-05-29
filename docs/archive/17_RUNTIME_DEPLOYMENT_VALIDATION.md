# 运行时部署验证文档

生成时间：2026-05-22

---

## 一、Redis 空密码/有密码两种启动方式

### 启动逻辑

Redis 容器通过 `deploy/scripts/redis-entrypoint.sh` 启动：

```bash
if [ -n "$REDIS_PASSWORD" ]; then
  exec redis-server /etc/redis/redis.conf --requirepass "$REDIS_PASSWORD"
else
  exec redis-server /etc/redis/redis.conf
fi
```

- `REDIS_PASSWORD` 为空时：不启用 requirepass，无需密码连接
- `REDIS_PASSWORD` 非空时：启用 requirepass，连接需密码认证

### entrypoint 执行方式

```yaml
entrypoint: ["sh", "/usr/local/bin/redis-entrypoint.sh"]
```

使用 `sh` 执行脚本，不依赖宿主机文件的可执行权限（`+x`），避免 permission denied。

### API 客户端适配

`apps/api/src/common/redis/redis.module.ts` 中：

```typescript
const password = configService.get('REDIS_PASSWORD', '');
const options: any = { host, port, db };
if (password) options.password = password;
```

空字符串时不会发送 AUTH 命令，避免 ioredis 异常。

### Healthcheck 适配

```yaml
healthcheck:
  test: ["CMD", "sh", "-c", "if [ -n \"$REDIS_PASSWORD\" ]; then redis-cli -a \"$REDIS_PASSWORD\" ping | grep PONG; else redis-cli ping | grep PONG; fi"]
```

---

## 二、/api/health 返回 503 的规则

| 状态 | HTTP 状态码 | body |
|------|-----------|------|
| database=ok, redis=ok | 200 | `{ "status": "ok", "services": { "database": "ok", "redis": "ok" } }` |
| 任一异常 | 503 | `{ "status": "degraded", "services": { "database": "error", "redis": "ok" } }` |

Docker healthcheck 配置为调用 `/api/health`，HTTP 503 会被 Docker 识别为 unhealthy。

---

## 三、runtime-smoke-test.sh 如何执行

### 开发/测试环境

```bash
SMOKE_TEST_BYPASS_CAPTCHA=true bash scripts/runtime-smoke-test.sh http://localhost:3000/api
```

### 生产环境（使用 ADMIN_TOKEN）

```bash
ADMIN_TOKEN="eyJhbGci..." IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名.com/api
```

### 生产环境（无 ADMIN_TOKEN）

```bash
IS_PRODUCTION=true bash scripts/runtime-smoke-test.sh https://你的域名.com/api
```

无 ADMIN_TOKEN 时，管理员登录项会被标记为 SKIP，不影响核心测试通过。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_TOKEN` | 空 | 外部传入的管理员 JWT token |
| `IS_PRODUCTION` | `false` | 是否为生产环境 |
| `SMOKE_TEST_BYPASS_CAPTCHA` | 空 | 是否允许绕过验证码（仅非生产环境生效） |

### 检查项

1. GET /api/health 返回 HTTP 200
2. 公开接口返回 `code: 0`
3. 未登录访问受保护接口返回 `code: 401`（注意：后端统一返回 HTTP 200，错误码在 body 中）
4. 管理员登录（生产环境使用 ADMIN_TOKEN，非生产环境可用 SMOKE_TEST_BYPASS_CAPTCHA）
5. 管理员 token 访问 /admin/auth/info 返回 `code: 0`
6. 普通用户 token 不能访问 /admin/*
7. 支付回调返回原始 `{"code":"FAIL",...}` 格式（不被统一包装）

### 测试结果

脚本输出区分三种结果：
- **PASS**：测试通过
- **FAIL**：测试失败（核心接口失败会导致 exit 1）
- **SKIP**：跳过（管理员登录在生产环境无 ADMIN_TOKEN 时跳过，不影响最终结果）

---

## 四、管理员登录验证码测试模式如何控制

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SMOKE_TEST_BYPASS_CAPTCHA` | `false` | 是否允许绕过验证码 |
| `NODE_ENV` | `development` | 运行环境 |

### 绕过条件（必须全部满足）

1. `NODE_ENV !== 'production'`
2. `SMOKE_TEST_BYPASS_CAPTCHA === 'true'`
3. `captchaId === 'smoke-test'`
4. `captchaCode === 'bypass'`

### 安全保障

- 生产环境（`NODE_ENV=production`）**永远无法**绕过验证码
- 即使配置了 `SMOKE_TEST_BYPASS_CAPTCHA=true`，生产环境下也不生效
- 必须使用特定的 captchaId 和 captchaCode，不能用于任意登录
- 冒烟测试脚本中 `IS_PRODUCTION=true` 时，不会尝试 SMOKE_TEST_BYPASS_CAPTCHA 绕过

---

## 五、支付配置启动校验项

### 生产环境（NODE_ENV=production）必须配置

| 环境变量 | 校验规则 |
|----------|---------|
| `WECHAT_APP_ID` | 非空 |
| `WECHAT_MCH_ID` | 非空 |
| `WECHAT_MCH_SERIAL_NO` | 非空 |
| `WECHAT_API_V3_KEY` | 非空且必须为 32 字节 |
| `WECHAT_PRIVATE_KEY_PATH` | 非空且文件必须存在可读 |
| `WECHAT_PLATFORM_CERT_PATH` | 非空且文件必须存在可读 |
| `WECHAT_NOTIFY_URL` | 非空且必须以 `https://` 开头 |

### 校验失败行为

- 生产环境：服务启动失败，抛出明确错误信息
- 非生产环境：日志警告"支付功能不可用"，但允许继续运行

---

## 六、生产环境必须配置的证书和环境变量

### 证书文件

| 证书 | 宿主机路径 | 容器内路径 | Docker 挂载方式 |
|------|------|------|------|
| 商户私钥 | `deploy/certs/apiclient_key.pem` | `/app/certs/apiclient_key.pem` | bind mount `./certs:/app/certs:ro` |
| 微信支付平台证书 | `deploy/certs/wechatpay_platform.pem` | `/app/certs/wechatpay_platform.pem` | bind mount `./certs:/app/certs:ro` |

> **重要**：使用 bind mount（`./certs:/app/certs:ro`）而非命名卷，确保障书文件从宿主机 `deploy/certs/` 目录直接映射到容器内。

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `WECHAT_APP_ID` | 微信小程序 AppID | `wx1234567890` |
| `WECHAT_APP_SECRET` | 微信小程序 AppSecret | `abcdef...` |
| `WECHAT_MCH_ID` | 微信支付商户号 | `1234567890` |
| `WECHAT_MCH_SERIAL_NO` | 商户证书序列号 | `1234...` |
| `WECHAT_API_V3_KEY` | API V3 密钥（32字节） | `0123456789abcdef0123456789abcdef` |
| `WECHAT_PRIVATE_KEY_PATH` | 商户私钥路径 | `/app/certs/apiclient_key.pem` |
| `WECHAT_PLATFORM_CERT_PATH` | 平台证书路径 | `/app/certs/wechatpay_platform.pem` |
| `WECHAT_PLATFORM_CERT_SERIAL_NO` | 平台证书序列号 | `5678...` |
| `WECHAT_NOTIFY_URL` | 支付回调地址 | `https://your-domain.com/api/weapp/pay/callback` |
| `WECHAT_SKIP_VERIFY` | 跳过验签（仅非生产） | `false` |
| `REDIS_PASSWORD` | Redis 密码 | 强密码 |
| `DB_PASSWORD` | MySQL 密码 | 强密码 |
| `JWT_SECRET` | JWT 签名密钥 | 随机长字符串 |
| `ADMIN_DEFAULT_USERNAME` | 生产管理员用户名（必填） | `admin` |
| `ADMIN_DEFAULT_PASSWORD` | 生产管理员密码（必填，≥12位含大小写+数字+特殊字符） | `Xiyun@2026!Prod` |

---

## 七、管理员密码安全

### 生产环境密码要求

- `ADMIN_DEFAULT_USERNAME` 必填
- `ADMIN_DEFAULT_PASSWORD` 必填
- 密码长度不少于 12 位
- 必须包含大写字母、小写字母、数字和特殊字符
- 不允许弱密码：`admin123`、`password`、`123456`、`change_this_password`
- seed 输出不会打印真实密码

### 首次登录强制改密

- 生产环境 seed 创建的管理员 `mustChangePassword=true`
- 管理员登录返回 `mustChangePassword` 字段
- 修改密码成功后 `mustChangePassword=false`
- 非生产环境默认不强制改密
- 前端拦截（mustChangePassword=true 时只允许进入修改密码页）待验收

---

## 八、仍需真实服务器验证的项目

| 项目 | 原因 |
|------|------|
| `docker compose build` | 本地 Docker Desktop 未运行 |
| `docker compose up -d` | 本地 Docker Desktop 未运行 |
| MySQL + Redis 连接 | 本地无 MySQL/Redis 服务 |
| 管理员登录完整流程 | 需要 MySQL 中有种子数据 |
| 订单创建/取消/支付完整链路 | 需要 MySQL + Redis 运行 |
| 微信支付真实回调 | 需要微信支付平台证书和域名 |
| 定时任务执行 | 需要长时间运行的服务 |
| SSL 证书 | 需要域名和证书 |
| 前端 mustChangePassword 拦截 | 后端已完成，前端拦截待验收 |
