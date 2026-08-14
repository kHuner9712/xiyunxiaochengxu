# 历史服务器部署命令（已停用）

> **此文档已停用，不得复制其中历史命令执行生产部署。**

旧版流程曾包含手工 Docker 启动、手工数据库迁移、旧 TLS 路径和历史预生产脚本。它们无法保证发布 SHA、生产预检、备份恢复演练和完整 smoke 属于同一个候选版本，因此不再受支持。

当前生产操作只以以下文档为准：

- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/ENV_PRODUCTION_FILL_GUIDE.md`

正式部署唯一入口：

```bash
EXPECTED_DEPLOY_SHA=<approved-40-char-main-sha> \
ENV_FILE=.env.production \
pnpm deploy:prod
```

如本文件与上述当前文档存在任何冲突，以当前文档和 `deploy/scripts/deploy-production.sh` 的 fail-closed 行为为准。
