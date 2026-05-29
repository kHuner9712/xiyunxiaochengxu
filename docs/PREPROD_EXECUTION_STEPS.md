# 禧孕优选 预生产执行清单（PREPROD_EXECUTION_STEPS）

当前结论：**可进入预生产部署，不可正式发布**。  
正式发布前仍必须通过 `release:check:prod` 严格门禁，并完成真实资料与真机验收。

为避免命令漂移，本文件只保留执行顺序；完整命令以以下两份为准：

1. `docs/DEPLOYMENT_RUNBOOK.md`（部署流程）
2. `docs/SERVER_DEPLOY_COMMANDS.md`（可复制命令）

## 执行顺序

1. 按 `docs/DEPLOYMENT_CHECKLIST.md` 完成服务器、域名、证书、变量准备。
2. 按 `docs/ENV_PRODUCTION_FILL_GUIDE.md` 填写服务器本地 `.env.production`。
3. 执行 `pnpm release:check` 与 `pnpm release:check:prod`。
4. 运行 `ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh`。
5. 按 Runbook 启动容器并完成健康检查。
6. 使用真实 AppID 构建小程序体验版并执行真机验收。
7. 在 `docs/PREPROD_ACCEPTANCE_RECORD.md` 留痕验收结果。

## 验收出口

1. 功能与合规项：`docs/MANUAL_ACCEPTANCE_CHECKLIST.md`
2. 人工真实资料：`docs/OPERATOR_REQUIRED.md`
3. 协议与联系方式：`docs/LEGAL_CONTENT_GUIDE.md`
