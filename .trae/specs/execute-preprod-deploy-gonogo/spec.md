# 预生产实机部署 + 真机验收 + Go/No-Go 最终评审 Spec

## Why
RC2 代码冻结已完成，但预生产环境尚未真实部署、smoke 尚未真实执行、小程序体验版尚未上传、真机验收尚未执行。需要完成真实部署验收流程并形成最终 Go/No-Go 结论。

## What Changes
- 核对 main HEAD 与 v1.0.0-rc.2 tag 对齐
- 修正 GO_LIVE.md / RELEASE_CANDIDATE.md 文档一致性（commit hash / release-check 结果）
- 重新执行本地质量门禁确认
- 输出服务器部署命令清单（当前环境非服务器）
- 输出小程序体验版人工上传步骤（当前环境非微信开发者工具）
- 确认微信审核材料完整性并补齐缺口
- 更新 GO_LIVE.md Go/No-Go 判定表和验收记录
- 更新 RELEASE_CANDIDATE.md 状态

## Impact
- Affected docs: GO_LIVE.md, RELEASE_CANDIDATE.md, docs/14_WECHAT_REVIEW_PACKAGE.md
- Affected git: 如有修复提交则创建 v1.0.0-rc.3

## ADDED Requirements

### Requirement: 文档一致性校准
GO_LIVE.md 和 RELEASE_CANDIDATE.md 的 commit hash、release-check 结果、当前阶段 SHALL 完全一致，以最新真实执行结果为准。

### Requirement: 真实部署状态记录
所有部署/验收项 SHALL 基于真实执行结果。当前环境为 Windows 开发机，不是预生产服务器，因此预生产部署、smoke 执行、体验版上传、真机验收 SHALL 保持未勾选状态，并输出完整的服务器执行命令清单和人工操作步骤。

### Requirement: Go/No-Go 最终评审
GO_LIVE.md SHALL 包含基于真实状态的 Go/No-Go 判定。未满足的条件明确标注为 No-Go 并说明阻塞原因。

## MODIFIED Requirements

### Requirement: GO_LIVE.md 当前阶段
GO_LIVE.md 当前阶段 SHALL 反映真实状态。如果预生产未部署，写"代码冻结完成 → 待预生产实机部署"。

### Requirement: 微信审核材料补齐
docs/14_WECHAT_REVIEW_PACKAGE.md 中主体信息、隐私协议入口等占位符 SHALL 明确标注"待填写"并说明由谁在何时填写。
