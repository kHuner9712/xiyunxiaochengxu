# 禧孕优选

临沂禧孕文化传媒有限公司自营母婴用品商城微信小程序项目。

## 项目结构

- `apps/miniprogram`：uni-app + Vue3 + TypeScript 微信小程序端
- `apps/admin-web`：Vue3 + Vite + Element Plus 管理后台
- `apps/api`：NestJS + Prisma + MySQL + Redis 后端 API
- `packages/shared`：共享类型/常量/工具
- `deploy`：Docker Compose + Nginx + HTTPS 部署脚本

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
pnpm build:mini:prod
```

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

## 预生产部署命令

```bash
# 先生成私有生产配置（不要提交）
cp .env.production.example .env.production

# 仅配置校验（不启动）
cd deploy
docker compose --env-file ../.env.production config

# 完整预生产检查 + 启动
ENV_FILE=../.env.production bash deploy/scripts/deploy-prod-check.sh
```

生产环境变量模板：`/.env.production.example`

## 安全红线（必须遵守）

- 严禁提交 `.env.production`
- 严禁提交真实 AppSecret、APIv3 Key、数据库密码、JWT 密钥
- 严禁提交 `apiclient_key.pem`、`wechatpay_platform.pem`、SSL 私钥等证书文件
- 营业执照号、备案号、食品/奶粉/保健品资质编号不得编造

必填人工信息见：[docs/OPERATOR_REQUIRED.md](docs/OPERATOR_REQUIRED.md)

## 上线文档

- [GO_LIVE.md](GO_LIVE.md)
- [RELEASE_CANDIDATE.md](RELEASE_CANDIDATE.md)
- [docs/FUNCTION_COMPLETENESS.md](docs/FUNCTION_COMPLETENESS.md)
- [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)
- [docs/PREPROD_EXECUTION_STEPS.md](docs/PREPROD_EXECUTION_STEPS.md)
- [docs/MANUAL_ACCEPTANCE_CHECKLIST.md](docs/MANUAL_ACCEPTANCE_CHECKLIST.md)
- [docs/LEGAL_CONTENT_GUIDE.md](docs/LEGAL_CONTENT_GUIDE.md)
