# RELEASE_CANDIDATE

更新日期：2026-08-13

## 用途

本文件只定义“什么证据才允许把某个版本视为正式版候选”，不保存历史 PR、历史 SHA、历史测试数量，也不作为部署命令来源。

## 候选身份

候选必须绑定一个明确的完整 Git SHA。代码发生任何变化后，旧 SHA 的测试、构建和验收结果不得复用到新版本。

候选进入生产验收前，同一精确 HEAD 必须完成并通过：

- CI
- Release Gate Check
- API Unit Diagnostic
- API E2E Diagnostic
- API Open Handle Diagnostic
- Production Container Bootstrap

仓库门禁通过只说明代码版本具备进入生产验收的资格，不代表服务器、微信支付、微信后台或真机已经可用。

## 外部生产证据

以下项目必须在真实环境单独验证并留痕，不能用“负责人确认”或仓库绿色结果替代：

- 生产服务器私有环境变量、MySQL、Redis、DNS、TLS。
- 微信小程序真实 AppID、合法域名、隐私保护指引、客服能力。
- 微信支付商户配置、证书、支付/退款回调真实可达与验签。
- 生产备份恢复、运行时健康检查和完整 production smoke。
- 微信体验版上传及真实设备核心业务链。

公开仓库不保存真实密钥、私钥和生产密码；这些值不在 Git 中出现是正确安全边界，但“仓库中没有”不等于“生产已经配置完成”。

## 正式发布判定

只有 Repository、Runtime、WeChat Platform、Real Device 四层均存在当前候选 SHA 对应的可验证证据，才能将正式发布状态改为 Go。

任何一层未知、失败、证据属于旧 SHA，或只凭口头确认，都保持 No-Go。

具体部署与验收流程只以以下当前文档为准：

- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/ENV_PRODUCTION_FILL_GUIDE.md`
- `docs/MANUAL_ACCEPTANCE_CHECKLIST.md`
- `docs/OPERATOR_REQUIRED.md`
