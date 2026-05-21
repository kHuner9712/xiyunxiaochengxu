# 上线前工程修复报告

生成时间：2026-05-22

---

## 一、修复的问题清单

### 1. Prisma Schema 与代码字段不一致（步骤二）

| 问题 | 修复 |
|------|------|
| `home.service.ts` 使用 `recommendSort` | 改为 `sortOrder` |
| `home.service.ts` 使用 `isNew` | 移除，改用 `createdAt` 降序 |
| `home.service.ts` 使用 `applicableMinAge` | 改为 `recommendAgeMin` |
| `home.service.ts` 使用 `applicableMaxAge` | 改为 `recommendAgeMax` |
| `dashboard.service.ts` 引用 `OrderStatus.paid` | 移除，使用 `pending_delivery` |
| BigInt 返回 JSON 序列化报错 | 在 `main.ts` 添加 `BigInt.prototype.toJSON` |
| 58+ 个 DTO 属性缺少 `!` 断言 | 补充 `!` definite assignment |
| `@nestjs/mapped-types` 未安装 | 改用 `@nestjs/swagger` 的 `PartialType` |
| Prisma schema 缺少 `SearchKeyword` 模型 | 添加模型 |
| Prisma schema 缺少 `User→MemberLevel` 关系 | 添加关系 |
| `OrderPayment/OrderDelivery` 缺少 `@unique` | 添加 `@unique` 约束 |

### 2. 小程序接口路径统一（步骤三）

所有 `apps/miniprogram/src/api/` 下 18 个文件的接口路径统一补齐 `/weapp` 前缀：

- `/home/data` → `/weapp/home/data`
- `/order/create` → `/weapp/order/create`
- `/order/list` → `/weapp/order/list`
- `/order/detail/:id` → `/weapp/order/detail/:id`
- `/order/cancel/:id` → `/weapp/order/cancel/:id`
- `/order/confirm/:id` → `/weapp/order/confirm-receive/:id`
- `/category/tree` → `/weapp/category/tree`
- `/product/list` → `/weapp/product/list`
- `/product/detail/:id` → `/weapp/product/detail/:id`
- `/cart/*` → `/weapp/cart/*`
- `/coupon/*` → `/weapp/coupon/*`
- `/member/*` → `/weapp/member/*`
- `/points/*` → `/weapp/points/*`
- `/baby/*` → `/weapp/baby/*`
- `/activity/*` → `/weapp/activity/*`
- `/aftersale/*` → `/weapp/aftersale/*`
- `/content/*` → `/weapp/content/*`
- `/pay/*` → `/weapp/pay/*`

### 3. 小程序请求 BASE_URL 修复（步骤四）

- `BASE_URL` 从硬编码 `'/api'` 改为读取 `import.meta.env.VITE_API_BASE_URL`
- 新增 `apps/miniprogram/.env.example`，包含 `VITE_API_BASE_URL=https://your-domain.com/api`

### 4. 后台前端与后端接口不一致（步骤五）

采用方案 A：补齐后端接口

- 新增 `PUT /api/admin/order/cancel/:id` — 管理员取消订单
- 新增 `GET /api/admin/order/delivery-list` — 待发货列表
- 新增 `POST /api/admin/order/batch-deliver` — 批量发货

### 5. 微信登录环境变量统一（步骤六）

- `auth.service.ts` 中 `WECHAT_APPID` → `WECHAT_APP_ID`
- `.env.example` 同步修改
- `deploy/docker-compose.yml` 同步修改

### 6. 微信支付 V3 实现（步骤七）

- 完整实现 JSAPI 支付，替换 mock
- `POST /api/weapp/pay/create` — 创建支付（校验订单、调用 V3 下单、生成 requestPayment 参数）
- `POST /api/weapp/pay/callback` — 支付回调（@Public、验签、AES-256-GCM 解密、幂等、状态→pending_delivery）
- `GET /api/weapp/pay/status/:orderId` — 查询支付状态
- 支持环境变量：WECHAT_APP_ID、WECHAT_MCH_ID、WECHAT_MCH_SERIAL_NO、WECHAT_API_V3_KEY、WECHAT_PRIVATE_KEY_PATH、WECHAT_NOTIFY_URL

### 7. 订单状态流转修复（步骤八）

- 支付成功后状态从 `paid` 改为 `pending_delivery`
- 取消订单（pending_payment）时归还库存、积分、优惠券
- 超时关闭订单自动归还库存、积分、优惠券
- 发货仅允许 `pending_delivery`
- 确认收货仅允许 `delivered`

### 8. 定时任务实现（步骤九）

- 安装 `@nestjs/schedule`
- 每 1 分钟扫描 `pending_payment` 且 `autoCloseAt` 已过期的订单，自动关闭
- 每天凌晨 2 点扫描 `delivered` 且 `autoCompleteAt` 已过期的订单，自动完成
- Redis SETNX 分布式锁，防止多实例重复执行
- 所有自动操作写入 `order_logs`

### 9. 权限体系修复（步骤十）

- 新增 `UserOnlyGuard`：只允许 `roleType=user` 访问 `/weapp` 需登录接口
- 新增 `AdminOnlyGuard`：只允许 `roleType=admin` 访问 `/admin` 接口
- 新增 `PermissionGuard`：按 `permission code` 校验
- 新增 `@RequirePermission('xxx')` 装饰器
- `@Public()` 仅允许公开浏览接口和微信支付回调
- 后台接口添加权限：product:list/create/update/delete/publish、order:list/detail/deliver/cancel/remark、order:aftersale/aftersale:review/aftersale:refund、marketing:coupon/activity/banner、user:list/detail/member/points、system:admin/role/config/log

### 10. 统一错误码（步骤十一）

- 0：成功
- 400：参数错误
- 401：未登录或登录过期
- 403：无权限
- 404：资源不存在
- 500：服务器错误

修改文件：
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/admin-web/src/utils/request.ts` — code===401 清除 token 并跳转登录
- `apps/miniprogram/src/utils/request.ts` — 同上

### 11. Docker 部署修复（步骤十二）

- `docker-compose.yml` 添加 `DATABASE_URL=mysql://root:${DB_PASSWORD}@mysql:3306/${DB_NAME}`
- `Dockerfile.api` 改 `--frozen-lockfile` 为 `--no-frozen-lockfile`
- 新增 `deploy/scripts/entrypoint.sh`，启动前执行 `prisma migrate deploy`
- 添加 `wechat_certs` volume 挂载
- MySQL/Redis 添加 healthcheck
- API 添加 `depends_on: service_healthy`
- 移除过时的 `version: '3.8'`

### 12. Admin-web TypeScript 编译错误修复

- 6 个 TS7053 错误（模板中对象字面量索引缺少类型声明）：定义为 `Record<number, string>` 类型常量
- 1 个 TS2339 错误（statistics/index.vue 引用不存在的 `searchForm`）：移除无用的 `:model="searchForm"`
- 1 个 TS2345 错误（user/baby.vue `userId` string vs number）：添加 `Number()` 转换，API 接口添加 `name` 参数

### 13. 小程序构建错误修复

- `PriceDisplay.vue` 中 `v-bind(color || '$primary-color')` 语法错误：改为 computed `priceColor` + `v-bind(priceColor)`

---

## 二、修改的文件清单

### 后端 API

| 文件 | 修改内容 |
|------|----------|
| `apps/api/src/main.ts` | 添加 BigInt.prototype.toJSON 序列化 |
| `apps/api/src/app.module.ts` | 导入 ScheduleModule |
| `apps/api/src/home/home.service.ts` | 修复字段名：sortOrder/recommendAgeMin/recommendAgeMax |
| `apps/api/src/auth/auth.service.ts` | WECHAT_APPID → WECHAT_APP_ID |
| `apps/api/src/dashboard/dashboard.service.ts` | 移除 OrderStatus.paid 引用 |
| `apps/api/src/payment/payment.service.ts` | 完整重写：真实微信支付 V3 JSAPI |
| `apps/api/src/payment/payment.controller.ts` | 新增 /weapp/pay/create、callback、status |
| `apps/api/src/payment/payment.module.ts` | 添加 HttpModule |
| `apps/api/src/order/order.controller.ts` | 新增 admin 接口 + @RequirePermission |
| `apps/api/src/order/order.service.ts` | 新增 adminCancel/findDeliveryList/batchDeliver |
| `apps/api/src/schedule/schedule.module.ts` | 新增定时任务模块 |
| `apps/api/src/schedule/schedule.service.ts` | 新增定时关闭/自动完成订单 |
| `apps/api/src/common/filters/http-exception.filter.ts` | 统一错误码 0/400/401/403/404/500 |
| `apps/api/src/common/guards/jwt-auth.guard.ts` | 重写：区分 /weapp 和 /admin 路由 |
| `apps/api/src/common/guards/user-only.guard.ts` | 新增 |
| `apps/api/src/common/guards/admin-only.guard.ts` | 新增 |
| `apps/api/src/common/guards/permission.guard.ts` | 新增 |
| `apps/api/src/common/decorators/require-permission.decorator.ts` | 新增 |
| `apps/api/prisma/schema.prisma` | 添加 SearchKeyword、修复关系、@unique |
| 25+ 个 DTO 文件 | 补充 `!` 断言 |
| 多个 Controller 文件 | 添加 @RequirePermission 装饰器 |

### 管理后台前端

| 文件 | 修改内容 |
|------|----------|
| `apps/admin-web/src/utils/request.ts` | 统一错误码，401 清除 token 跳转登录 |
| `apps/admin-web/src/views/marketing/activity-list.vue` | 修复活动类型 + TS7053 |
| `apps/admin-web/src/views/marketing/activity-edit.vue` | 修复活动类型 |
| `apps/admin-web/src/views/marketing/banner.vue` | TS7053 修复 |
| `apps/admin-web/src/views/marketing/recommendation.vue` | TS7053 修复 |
| `apps/admin-web/src/views/content/list.vue` | TS7053 修复 |
| `apps/admin-web/src/views/order/aftersale.vue` | TS7053 修复 |
| `apps/admin-web/src/views/order/aftersale-detail.vue` | TS7053 修复 |
| `apps/admin-web/src/views/statistics/index.vue` | TS2339 修复 |
| `apps/admin-web/src/views/user/baby.vue` | TS2345 修复 |
| `apps/admin-web/src/api/user.ts` | getBabyList 添加 name 参数 |
| `apps/admin-web/package.json` | vue-tsc 升级到 ^2.0.0 |

### 小程序

| 文件 | 修改内容 |
|------|----------|
| `apps/miniprogram/src/utils/request.ts` | BASE_URL 改为环境变量 |
| `apps/miniprogram/.env.example` | 新增 |
| `apps/miniprogram/src/api/` 下 18 个文件 | 统一 /weapp 前缀 |
| `apps/miniprogram/src/api/payment.ts` | 更新为 /weapp/pay/create 和 /weapp/pay/status/ |
| `apps/miniprogram/src/components/PriceDisplay.vue` | 修复 v-bind CSS 语法 |
| `apps/miniprogram/package.json` | 修复 @dcloudio 版本号 |

### 部署

| 文件 | 修改内容 |
|------|----------|
| `deploy/docker-compose.yml` | 添加 DATABASE_URL、healthcheck、移除 version |
| `deploy/Dockerfile.api` | --no-frozen-lockfile、admin-builder stage |
| `deploy/scripts/entrypoint.sh` | 新增：prisma migrate deploy + 启动 |
| `.env.example` | 统一环境变量名 |

---

## 三、构建验证结果

### 1. pnpm install

✅ **成功**

### 2. pnpm --filter @baby-mall/shared build

✅ **成功** — TypeScript 编译通过

### 3. pnpm --filter @baby-mall/api prisma:generate

✅ **成功** — Prisma Client v5.22.0 生成完成

### 4. pnpm --filter @baby-mall/api build

✅ **成功** — NestJS 编译通过

### 5. pnpm --filter @baby-mall/admin-web build

✅ **成功** — vue-tsc 类型检查通过，Vite 构建完成（1850 modules，17.18s）

### 6. pnpm --filter @baby-mall/miniprogram build:mp-weixin

✅ **成功** — uni-app 编译完成，输出到 dist/build/mp-weixin

### 7. docker compose -f deploy/docker-compose.yml config

✅ **成功** — 配置验证通过（环境变量警告为预期行为，需部署时配置 .env）

### 8. docker compose -f deploy/docker-compose.yml build

⚠️ **Docker Desktop 未运行** — 配置本身无问题，需在部署服务器上执行构建

---

## 四、当前仍未完成的问题

1. **Docker 镜像构建**：需在安装了 Docker 的服务器上执行 `docker compose build`
2. **数据库迁移**：首次部署需执行 `npx prisma migrate deploy` 和 `npx prisma db seed`
3. **微信支付证书**：需将 `apiclient_key.pem` 放入 `wechat_certs` volume
4. **SSL 证书**：Nginx HTTPS 需配置 SSL 证书
5. **微信小程序 request 合法域名**：需在微信公众平台配置后端域名
6. **Sass @import 废弃警告**：建议后续迁移到 `@use` 语法（不影响功能）
7. **admin-web 首页 chunk 过大**（1243KB）：建议后续添加代码分割优化

---

## 五、下一步上线前检查清单

- [ ] 在部署服务器执行 `docker compose -f deploy/docker-compose.yml build` 确认镜像构建
- [ ] 配置 `.env` 文件，填入真实的微信 AppID/AppSecret/MchID/V3Key
- [ ] 放置微信支付商户私钥到 `wechat_certs` volume
- [ ] 配置 SSL 证书到 Nginx
- [ ] 执行 `docker compose up -d` 启动服务
- [ ] 执行 `docker compose exec api npx prisma migrate deploy` 数据库迁移
- [ ] 执行 `docker compose exec api npx prisma db seed` 初始化种子数据
- [ ] 微信公众平台配置 request 合法域名
- [ ] 微信支付平台配置回调地址（WECHAT_NOTIFY_URL）
- [ ] 使用微信开发者工具导入 `dist/build/mp-weixin` 测试小程序
- [ ] 测试核心交易链路：登录→浏览→加购→下单→支付→发货→确认收货
- [ ] 测试后台管理：登录→商品管理→订单管理→发货→售后审核
- [ ] 测试定时任务：超时订单自动关闭、自动确认收货
- [ ] 测试权限控制：普通用户无法访问 /admin 接口
- [ ] 压力测试和性能优化
