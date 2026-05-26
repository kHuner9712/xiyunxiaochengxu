# 预生产真实验收 + Go/No-Go 发布决策 Spec

## Why
RC2 代码冻结已完成，但预生产环境尚未真实部署、smoke 尚未真实执行、小程序体验版尚未上传、真机验收尚未执行。需要完成真实验收流程并给出 Go/No-Go 发布决策。

## What Changes
- 确认 main HEAD 与 v1.0.0-rc.2 tag 对齐
- 确认 GitHub Actions CI/release-check workflow 状态
- 输出服务器部署命令清单（当前环境非服务器）
- 输出小程序体验版人工上传步骤（当前环境非微信开发者工具）
- 确认微信审核材料完整性
- 更新 GO_LIVE.md 状态和验收记录
- 更新 RELEASE_CANDIDATE.md 状态
- 执行 Go/No-Go 评审并记录结论

## Impact
- Affected docs: GO_LIVE.md, RELEASE_CANDIDATE.md
- Affected git: 可能需要 v1.0.0-rc.3 tag（如发现 P0/P1 需修复）
- 不修改业务代码（除非发现 P0/P1 bug）

## ADDED Requirements

### Requirement: Go/No-Go 发布决策
GO_LIVE.md SHALL 包含基于真实验收结果的 Go/No-Go 判定。未实际完成的验收项不得标记为通过。如果预生产环境未部署，判定为 No-Go 或 Conditional Go（待部署）。

### Requirement: 真实验收记录
所有验收记录 SHALL 写入 GO_LIVE.md 验收记录表，包含日期、验收人、验收项、结果、问题、关联 commit/issue。未实际执行的验收项保持未勾选。

### Requirement: 服务器部署命令清单
如果当前环境不是预生产服务器，SHALL 输出完整的服务器执行命令清单，包括环境变量配置、Docker 部署、smoke test、数据库迁移等步骤。

### Requirement: 小程序体验版上传步骤
如果当前环境无法操作微信开发者工具，SHALL 输出完整的人工上传步骤，包括 AppID、版本号、构建产物路径、域名配置等。

## MODIFIED Requirements

### Requirement: GO_LIVE.md 当前阶段
GO_LIVE.md 当前阶段 SHALL 反映真实状态：如果预生产未部署，写"代码冻结完成 → 待预生产实机部署"；如果已部署，写"预生产部署完成 → 待真机验收"。

### Requirement: RELEASE_CANDIDATE.md 状态
RELEASE_CANDIDATE.md SHALL 反映真实 CI/deployment/验收状态，不虚构已通过的结果。
