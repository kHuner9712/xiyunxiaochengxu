# 生产支付与部署硬化修复报告

生成时间：2026-05-22

---

## 一、修复的支付回调问题

### 1.1 支付回调响应格式被统一包装

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 回调响应 | `{ code:0, data:{ code:'SUCCESS' } }` | `{ code:'SUCCESS', message:'' }` |

**实现机制**：
- 新增 `@SkipTransform()` 装饰器（`apps/api/src/common/decorators/skip-transform.decorator.ts`）
- `TransformInterceptor` 检测 `@SkipTransform()` 后直接返回原始数据
- `/api/weapp/pay/callback` 添加 `@SkipTransform()`
- `/api/health` 同样添加 `@SkipTransform()`

### 1.2 支付回调用 rawBody 验签

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 验签消息 | `timestamp + "\n" + nonce + "\n" + JSON.stringify(body) + "\n"` | `timestamp + "\n" + nonce + "\n" + rawBody + "\n"` |

**实现机制**：
- `NestFactory.create(AppModule, { rawBody: true })` 启用 rawBody
- `PaymentController.callback` 通过 `@Req() req` 获取 `req.rawBody`
- 传入 `PaymentService.handleCallback(body, headers, rawBody)`
- rawBody 不存在时直接返回 `{ code: 'FAIL', message: '缺少rawBody' }`
- body 仍用于 resource 解密

### 1.3 禁止生产环境跳过验签

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 证书缺失时 | `return true`（跳过验签） | 生产环境启动报错，非生产需 `WECHAT_SKIP_VERIFY=true` |

**实现机制**：
- `PaymentService` 构造函数检查：`NODE_ENV=production` 且证书缺失 → 抛出错误，模块不可启动
- `verifyWechatSignature` 不再因证书为空直接 return true
- 非生产环境 + `WECHAT_SKIP_VERIFY=true` 才允许跳过

### 1.4 支付回调序列号校验

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| wechatpay-serial | 读取但未校验 | 与 WECHAT_PLATFORM_CERT_SERIAL_NO 比对 |

**实现机制**：
- 回调 header 读取 `wechatpay-serial`
- 如果配置了 `WECHAT_PLATFORM_CERT_SERIAL_NO`，必须与 header 一致
- 不一致返回 `{ code: 'FAIL', message: '证书序列号不匹配' }`

---

## 二、rawBody 如何启用

在 `apps/api/src/main.ts` 中：

```typescript
const app = await NestFactory.create(AppModule, { rawBody: true });
```

NestJS 启用 rawBody 后，每个请求的 `req.rawBody` 包含原始请求体字符串。这是微信支付 V3 验签的必要条件，因为 NestJS 的 body parser 会重新序列化 JSON，导致签名不匹配。

---

## 三、SkipTransform 如何实现

1. **装饰器**：`@SkipTransform()` 使用 `SetMetadata('skip_transform', true)` 标记路由处理函数
2. **拦截器**：`TransformInterceptor` 注入 `Reflector`，在 `intercept()` 中检查 `skip_transform` 元数据
3. **跳过逻辑**：如果检测到 `@SkipTransform()`，直接 `return next.handle()`，不做 `{ code:0, message:'success', data }` 包装
4. **使用场景**：微信支付回调、健康检查等需要返回特定格式的接口

---

## 四、平台证书如何配置

| 证书 | 路径 | 环境变量 | 说明 |
|------|------|---------|------|
| 商户私钥 | `deploy/certs/apiclient_key.pem` | `WECHAT_PRIVATE_KEY_PATH=/app/certs/apiclient_key.pem` | 商户后台下载 |
| 平台证书 | `deploy/certs/wechatpay_platform.pem` | `WECHAT_PLATFORM_CERT_PATH=/app/certs/wechatpay_platform.pem` | 微信支付自动下载 |
| 证书序列号 | — | `WECHAT_PLATFORM_CERT_SERIAL_NO=xxx` | 商户后台查看 |

Docker 部署时，`wechat_certs` volume 挂载到 `/app/certs/`。

---

## 五、生产环境为何禁止 db push --accept-data-loss

| 命令 | 用途 | 风险 |
|------|------|------|
| `prisma db push --accept-data-loss` | 直接同步 schema 到数据库 | **会删除不在 schema 中的列和数据** |
| `prisma migrate deploy` | 执行 migration 文件 | 只执行增量变更，不会丢数据 |

生产环境必须使用 `prisma migrate deploy`，因为：
1. `db push --accept-data-loss` 可能导致数据丢失
2. `migrate deploy` 有审计追踪，可回滚
3. `db push` 不生成 migration 记录，无法追踪变更历史

---

## 六、Docker 运行时需人工配置的真实参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `DB_PASSWORD` | MySQL root 密码 | 强密码 |
| `JWT_SECRET` | JWT 签名密钥 | 随机长字符串 |
| `WECHAT_APP_ID` | 微信小程序 AppID | wx... |
| `WECHAT_APP_SECRET` | 微信小程序 AppSecret | ... |
| `WECHAT_MCH_ID` | 微信支付商户号 | 14... |
| `WECHAT_MCH_SERIAL_NO` | 商户证书序列号 | ... |
| `WECHAT_API_V3_KEY` | API V3 密钥 | 32位字符串 |
| `WECHAT_PLATFORM_CERT_SERIAL_NO` | 平台证书序列号 | ... |
| `WECHAT_NOTIFY_URL` | 支付回调地址 | `https://域名/api/weapp/pay/callback` |
| `REDIS_PASSWORD` | Redis 密码 | 强密码 |
| SSL 证书 | Nginx HTTPS | 放在 `deploy/nginx/ssl/` |
| 商户私钥 | 微信支付签名 | 放在 `deploy/certs/apiclient_key.pem` |
| 平台证书 | 微信支付验签 | 放在 `deploy/certs/wechatpay_platform.pem` |

---

## 七、如何执行 runtime-smoke-test.sh

```bash
# 本地环境
bash scripts/runtime-smoke-test.sh http://localhost:3000/api

# 生产环境
bash scripts/runtime-smoke-test.sh https://your-domain.com/api
```

检查项：
1. GET /api/health 可访问
2. GET /api/weapp/home/data 可访问
3. GET /api/weapp/category/tree 可访问
4. GET /api/weapp/product/list 可访问
5. 未登录访问 /api/weapp/cart/list 返回 401
6. 未登录访问 /api/admin/order/list 返回 401
7. 管理员登录流程可用
8. 管理员 token 访问 /api/admin/auth/info 可用
9. 普通用户 token 不能访问 /api/admin/*
10. 支付回调接口返回原始 `{"code":"FAIL",...}` 格式

---

## 八、修改的文件清单

| 文件 | 修改内容 |
|------|---------|
| `apps/api/src/common/decorators/skip-transform.decorator.ts` | 新增 @SkipTransform() 装饰器 |
| `apps/api/src/common/interceptors/transform.interceptor.ts` | 检测 @SkipTransform() 跳过包装 |
| `apps/api/src/main.ts` | 启用 rawBody + Reflector 注入 |
| `apps/api/src/payment/payment.controller.ts` | @SkipTransform() + rawBody 传递 |
| `apps/api/src/payment/payment.service.ts` | rawBody 验签 + 禁止跳过验签 + 序列号校验 |
| `apps/api/src/health/health.controller.ts` | 新增健康检查接口 |
| `apps/api/src/health/health.module.ts` | 新增健康检查模块 |
| `apps/api/src/app.module.ts` | 导入 HealthModule |
| `apps/api/src/common/redis/redis.service.ts` | 添加 ping() 方法 |
| `apps/api/prisma/migrations/20260522000000_init/migration.sql` | 新增初始 migration |
| `apps/api/.env` | 添加平台证书相关变量 |
| `.env.example` | 添加平台证书 + SKIP_VERIFY 变量 |
| `deploy/scripts/entrypoint.sh` | 生产/开发环境区分 |
| `deploy/docker-compose.yml` | 添加环境变量 + healthcheck + Redis 密码 |
| `deploy/redis/redis.conf` | 移除 requirepass（改用命令行） |
| `scripts/runtime-smoke-test.sh` | 新增冒烟测试脚本 |
| `docs/11_DEPLOYMENT_GUIDE.md` | 更新部署文档 |
| `docs/15_ACCEPTANCE_TEST_REPORT.md` | 更新验收报告 |
