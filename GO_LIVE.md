# 禧孕优选 GO_LIVE 状态

更新日期：2026-08-13

## 当前原则

正式公开上线保持 **No-Go**，直到当前发布版本同时取得仓库、生产运行、微信平台和真机四层可核验证据。

本文件不保存历史 PR、历史 SHA 或历史测试数量。候选身份必须实时读取当前 PR / `main`；任何新提交都会使旧 HEAD 的绿色结果失效。

## 仓库候选门禁

同一精确 HEAD 必须全部通过：

- CI
- Release Gate Check
- API Unit Diagnostic
- API E2E Diagnostic
- API Open Handle Diagnostic
- Production Container Bootstrap

仓库门禁成功只代表该版本可以进入生产验收，不代表真实生产环境已经验收通过。

## 正式部署

生产部署只允许对已经合并到 `main` 的批准 SHA 执行：

```bash
EXPECTED_DEPLOY_SHA=<approved-40-char-main-sha> \
ENV_FILE=.env.production \
pnpm deploy:prod
```

不得用历史预生产脚本、手工容器启动或手工真实库操作替代正式入口。

## 当前生产事实源

具体生产准备、部署、回滚和验收只以以下文档为准：

- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/ENV_PRODUCTION_FILL_GUIDE.md`
- `docs/MANUAL_ACCEPTANCE_CHECKLIST.md`
- `docs/OPERATOR_REQUIRED.md`

## Go / No-Go

只有下面四层均有当前版本证据时才可标记 Go：

1. **Repository Go**：精确 HEAD 的六组门禁全部成功。
2. **Runtime Go**：批准的 `main` SHA 通过唯一生产部署入口和完整 production smoke。
3. **Platform Go**：微信小程序、支付、隐私、客服等平台配置完成真实验收。
4. **Device Go**：体验版在真实设备完成核心业务链验收。

任何一层未知、失败、证据属于旧 SHA，或只有口头确认，都保持 **No-Go**。
