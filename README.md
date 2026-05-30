# 禧孕优选

临沂禧孕文化传媒有限公司自营母婴用品商城微信小程序项目。

当前发布状态：**可进入预生产部署，不可正式发布**。

## 商用加固进展（2026-05-29）

- 订单完成奖励已统一为同一服务逻辑：快递确认收货、自提核销、自动完成均走幂等发奖路径。
- 库存回滚链路已加固：取消订单/超时关闭/售后退款回滚场景下，销量不会被扣为负数。
- 支付回调已加固补偿：已取消订单收到支付成功回调时，会创建补偿任务并返回 `SUCCESS`，避免无意义重试风暴。
- 类目新增合规配置模型：支持食品/保健/奶粉标记、资质图必填、扩展字段必填，并联动商品上架校验。
- 小程序生产构建门禁增强：`NODE_ENV=production` 下强制校验真实 `VITE_WX_APPID` 和非空 `VITE_API_BASE_URL`。

## 项目结构

- 见 `docs/PROJECT_STRUCTURE.md`

## 环境要求

- Node.js >= 18
- pnpm >= 8
- MySQL 8+
- Redis 7+
- Docker / Docker Compose（用于预生产部署）

## 本地安装

```bash
pnpm install
```

## 开发命令

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:mini
```

## 生产构建命令

```bash
pnpm build:api
pnpm build:admin
pnpm build:mini
pnpm build:all
pnpm build:mini:prod
```

冻结前推荐使用 `pnpm build:all` 覆盖 API、Admin 与小程序默认构建；上线门禁以 `pnpm release:check` 为准。

小程序体验版/正式版构建（必须真实 AppID）：

```bash
NODE_ENV=production VITE_WX_APPID=真实AppID pnpm build:mini
# 或
pnpm build:mini:prod
```

## 上线门禁命令

```bash
pnpm release:check
pnpm release:check:prod
```

- `release:check`：默认环境，允许占位 AppID（WARN）
- `release:check:prod`：强制生产门禁，缺少真实 AppID 或协议占位将直接 FAIL

## 前端构建依赖冻结说明

当前小程序 `@dcloudio/*` 依赖随 `pnpm-lock.yaml` 锁定在已验证的 alpha 版本。上线冻结期不要自动升级或切换稳定版；如需升级 UniApp 编译链，应单独开升级任务，并重新完成小程序构建、微信开发者工具预览与真机验收。

## 预生产部署命令

默认约定：以下部署命令默认在仓库根目录执行（`package.json` 所在目录）。

```bash
# 先生成私有生产配置（不要提交）
cp .env.production.example .env.production

# 仅配置校验（不启动）
(cd deploy && docker compose --env-file ../.env.production config)

# 完整预生产检查 + 启动
ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh
```

生产环境变量模板：`/.env.production.example`

说明：在未提供真实 AppID 与 `legal.ts` 最终联系方式前，`pnpm release:check:prod` 失败是预期阻断。

## 安全红线（必须遵守）

- 严禁提交 `.env.production`
- 严禁提交真实 AppSecret、APIv3 Key、数据库密码、JWT 密钥
- 严禁提交 `apiclient_key.pem`、`wechatpay_platform.pem`、SSL 私钥等证书文件
- 营业执照号、备案号、食品/奶粉/保健品资质编号不得编造

必填人工信息见：[docs/OPERATOR_REQUIRED.md](docs/OPERATOR_REQUIRED.md)

## 上线文档入口（当前有效）

- [GO_LIVE.md](GO_LIVE.md)
- [RELEASE_CANDIDATE.md](RELEASE_CANDIDATE.md)
- [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)
- [docs/SERVER_DEPLOY_COMMANDS.md](docs/SERVER_DEPLOY_COMMANDS.md)
- [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)
- [docs/PREPROD_EXECUTION_STEPS.md](docs/PREPROD_EXECUTION_STEPS.md)
- [docs/ENV_PRODUCTION_FILL_GUIDE.md](docs/ENV_PRODUCTION_FILL_GUIDE.md)
- [docs/MANUAL_ACCEPTANCE_CHECKLIST.md](docs/MANUAL_ACCEPTANCE_CHECKLIST.md)
- [docs/PREPROD_ACCEPTANCE_RECORD.md](docs/PREPROD_ACCEPTANCE_RECORD.md)
- [docs/LEGAL_CONTENT_GUIDE.md](docs/LEGAL_CONTENT_GUIDE.md)
- [docs/OPERATOR_REQUIRED.md](docs/OPERATOR_REQUIRED.md)
- [docs/FUNCTION_COMPLETENESS.md](docs/FUNCTION_COMPLETENESS.md)

历史阶段报告与旧版指引已归档到 `docs/archive/`，不再作为主入口。
