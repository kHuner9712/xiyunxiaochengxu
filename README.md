# 禧孕优选

临沂禧孕文化传媒有限公司自营母婴用品商城微信小程序项目，包含微信小程序、管理后台和 NestJS API。

## 环境要求

- Node.js `>=22.13.0 <25`
- pnpm `>=11.2.2 <12`
- MySQL 8
- Redis 7
- Docker / Docker Compose（生产部署）

版本约束以根目录 `package.json` 的 `engines` 与 `packageManager` 为准。

## 本地开发

```bash
pnpm install
pnpm dev:api
pnpm dev:admin
pnpm dev:mini
```

常用检查：

```bash
pnpm typecheck
pnpm lint
pnpm test:ci
pnpm build
pnpm release:check
```

## 小程序正式构建

正式小程序包只允许通过受控生产构建入口生成：

```bash
pnpm build:mini:prod
```

正式构建必须使用真实微信 AppID 和 HTTPS 生产 API 地址；本地、占位或未解析变量会被构建门禁拒绝。

## 生产部署

生产部署只有一个受支持入口。必须先将批准版本合并到 `main`，再针对批准的完整 SHA 执行：

```bash
EXPECTED_DEPLOY_SHA=<approved-40-char-main-sha> \
ENV_FILE=.env.production \
pnpm deploy:prod
```

不要用手工 Docker 启动、手工真实库迁移、旧预生产脚本或历史服务器命令替代正式部署入口。仓库测试通过也不等于生产服务器、微信支付或真机已经验收通过。

## 当前生产事实源

生产操作只以以下文档为准：

- [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) — 正式部署、回滚、备份恢复与运行时验收
- [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) — 上线前逐项检查
- [docs/ENV_PRODUCTION_FILL_GUIDE.md](docs/ENV_PRODUCTION_FILL_GUIDE.md) — 私有生产环境变量填写规则
- [docs/MANUAL_ACCEPTANCE_CHECKLIST.md](docs/MANUAL_ACCEPTANCE_CHECKLIST.md) — 微信体验版与真机业务验收
- [docs/OPERATOR_REQUIRED.md](docs/OPERATOR_REQUIRED.md) — 必须由运营/平台侧完成的外部事项

[GO_LIVE.md](GO_LIVE.md) 与 [RELEASE_CANDIDATE.md](RELEASE_CANDIDATE.md) 只用于记录候选状态和证据边界，不是部署命令来源。

历史阶段报告、旧预生产步骤和旧服务器命令不得作为当前生产操作依据。

## 安全红线

- 严禁提交 `.env.production` 或真实密钥、密码、AppSecret。
- 严禁提交商户私钥、微信平台证书私钥、TLS 私钥等敏感材料。
- 营业执照号、备案号、食品/奶粉/保健品资质编号不得编造。
- 正式上线前必须完成真实服务器、微信公众平台、微信支付和真机验收，并保存可核验证据。

## 项目结构

详见 [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)。
