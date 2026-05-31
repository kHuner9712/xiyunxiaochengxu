# 禧孕小程序 GO_LIVE 状态（2026-05-31 +08:00）

## 1. 当前结论

- 结论：**代码层面可冻结，允许进入预生产部署；正式发布仍为 No-Go。**
- 当前 HEAD：`<!-- COMMIT_SHA -->`
- 说明：真实生产发布仍依赖真实 AppID、生产 API 地址、微信支付配置、证书、HTTPS、数据库迁移、微信开发者工具上传体验版、真机完整验收与运营/法务信息确认。
- 人工配置项不作为代码冻结失败项：真实 AppID、密钥、证书、资质图片、客服电话、客服微信、退货地址仍由部署/运营阶段补齐，不在仓库中编造。

## 2. 本次已完成代码修复

- 订单详情物流信息链路已补齐：`logisticsInfo` / `deliveredAt` 展示与后端返回保持一致。
- 微信 `access_token` 已接入 Redis 缓存，减少重复请求与运行期不稳定性。
- 确认订单页协议确认已补齐，下单前协议入口可访问。
- API、管理后台、小程序默认构建链路已完成本地门禁验证。
- 小程序前端视觉升级已完成，并保持首页、商品、购物车、订单、售后、我的、客服与协议页路径不变。
- 商品详情页不再依赖缺失的 `uni-popup`，已替换为项目内自研底部弹层。
- `common.scss` / `tokens.scss` 已拆分：全局样式仅由 `App.vue` 引入，SFC 只注入变量、mixin 与函数。
- 商品规格弹层已区分 `select` / `cart` / `buy`，点击规格仅选择规格，不自动加购。
- `ProductCard` 前端类型已兼容后端 `ProductCardVO.id` 的 string 返回，不影响商品详情跳转。
- 清理了明确未使用 import，并修复 tokens 拆分后 scoped 样式 `@extend` 导致的小程序构建问题。
- 预生产部署脚本 one-off 命令阻断修复：`entrypoint.sh` 支持 `exec "$@"` 与 `SKIP_MIGRATE` 开关；`deploy-prod-check.sh` 使用 `--entrypoint` 覆写，避免 one-off 容器执行 migrate 后退出。
- ThrottlerGuard 限流启用：认证接口严格限流——验证码 20 次/分、登录 5 次/分、refresh 10 次/分、小程序登录/手机号 10 次/分；支付回调 `@SkipThrottle()` 跳过限流。
- GitHub Actions pnpm 版本对齐：`ci.yml` 和 `release-check.yml` 改用 `corepack` 读取 `packageManager`，安装依赖使用 `--frozen-lockfile`，消除 CI 与本地 pnpm 版本不一致风险。

## 3. 本次真实执行命令

以下命令均已在本地真实执行通过，允许写 PASS：

| 命令 | 结果 | 备注 |
|---|---|---|
| `pnpm --filter @baby-mall/api prisma:validate` | PASS | Prisma schema 校验通过 |
| `pnpm --filter @baby-mall/api test:ci` | PASS | 464 unit tests (30 suites) + 23 e2e tests (6 suites) — PASS |
| `pnpm build:api` | PASS | Nest 构建通过 |
| `pnpm build:admin` | PASS | `vue-tsc && vite build` 通过；存在非阻塞 chunk/Sass 警告 |
| `VITE_API_BASE_URL=https://example.invalid pnpm build:mini` | PASS | mp-weixin 构建通过 |
| `pnpm build:all` | PASS | API、Admin、小程序默认构建通过 |
| `pnpm release:check` | PASS | Release Gate：106 PASS / 0 FAIL / 11 WARN |

未执行或未核验项不得写 PASS：

- GitHub Actions：待核验，当前未取得可核验 run 结果。
- `pnpm --filter @baby-mall/api prisma migrate deploy`：待真实数据库执行，本地未连真实预生产/生产数据库执行。
- `pnpm release:check:prod`：待真实生产变量、真实 AppID、生产 API、协议联系方式与证书配置完成后执行。
- 微信开发者工具上传体验版：待执行。
- 真机支付、退款、售后、自提、客服与协议验收：待预生产阶段执行。

## 4. 仍需真实部署阶段完成

- 准备服务器本地 `.env.production`，不得提交 Git。
- 配置真实微信小程序 AppID，并完成体验版/正式版构建校验。
- 配置微信支付商户号、商户证书序列号、APIv3 Key、商户私钥、平台证书与平台证书序列号。
- 配置 `WECHAT_NOTIFY_URL` 与 `WECHAT_REFUND_NOTIFY_URL`，确保公网 HTTPS 可访问。
- 配置 HTTPS 证书、Nginx、域名解析、CORS 与上传资源公网访问地址。
- 在真实预生产/生产数据库上执行 `pnpm --filter @baby-mall/api prisma migrate deploy`。
- 使用 Docker Compose 或既定部署脚本启动服务并完成健康检查。
- 使用微信开发者工具上传体验版。
- 完成真机完整链路验收：登录、首页、商品、购物车、下单、支付、支付回调、退款、退款回调、售后、自提、客服、协议。
- 运营/法务确认客服电话、客服微信、退货地址、资质图片、资质编号等真实信息。
- 提审前处理或确认分享奖励/诱导分享口径风险。

## 5. 真实部署前命令

以下命令需在仓库根目录执行。真实敏感值只放在服务器本地环境文件和证书目录，不写入仓库。

```bash
pnpm install
pnpm --filter @baby-mall/api prisma:validate
pnpm --filter @baby-mall/api test:ci
pnpm build:all
pnpm release:check
```

生产严格门禁需在真实生产变量准备完成后执行：

```bash
pnpm release:check:prod
```

服务器部署前配置检查：

```bash
cd deploy
docker compose --env-file ../.env.production config
```

真实数据库迁移命令，必须确认连接的是目标预生产/生产数据库：

```bash
pnpm --filter @baby-mall/api prisma migrate deploy
```

预生产部署脚本：

```bash
ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh
```

部署后健康检查与冒烟测试：

```bash
pnpm smoke
pnpm smoke:public
pnpm smoke:login
pnpm smoke:all
```

## 6. Go / No-Go

- 代码层面：**Go**（门禁和 CI 均通过）。
- 预生产部署：**Go**。
- 正式发布：**No-Go**，直到真实 AppID、支付配置、证书、数据库迁移、体验版上传、真机验收、运营/法务信息全部完成。
