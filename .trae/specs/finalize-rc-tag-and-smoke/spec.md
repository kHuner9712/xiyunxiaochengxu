# 代码冻结前最后修正 + RC Tag 对齐 + Smoke 真实执行 Spec

## Why
当前 smoke-preprod.sh 仍有 MANUAL_COUNT 未初始化和支付回调检查方式错误的问题；RC tag v1.0.0-rc.1 可能不指向最终 commit；GO_LIVE.md 和 RELEASE_CANDIDATE.md 状态需要与真实执行结果对齐；缺少微信审核材料包文档。

## What Changes
- 修复 smoke-preprod.sh：初始化 MANUAL_COUNT、新增 manual() 函数、支付/退款回调改为环境变量检查+https 校验
- 修复 deploy.sh 或新增 deploy-preprod.sh：支持 --env-file、预生产域名输出、迁移失败 exit 1
- 创建 v1.0.0-rc.2 tag 对齐最终 commit
- 更新 RELEASE_CANDIDATE.md：RC 版本号改为 v1.0.0-rc.2、完整 commit hash、真实构建时间
- 更新 GO_LIVE.md：完整 commit hash、修改记录表新增、验收记录表新增
- 新增 docs/14_WECHAT_REVIEW_PACKAGE.md：微信审核材料包
- 重新执行质量门禁并记录真实结果

## Impact
- Affected code: deploy/scripts/smoke-preprod.sh, deploy/scripts/deploy.sh 或 deploy/scripts/deploy-preprod.sh
- Affected docs: GO_LIVE.md, RELEASE_CANDIDATE.md, docs/14_WECHAT_REVIEW_PACKAGE.md
- Affected git: tag v1.0.0-rc.2

## ADDED Requirements

### Requirement: smoke-preprod.sh MANUAL 项支持
smoke-preprod.sh SHALL 初始化 MANUAL_COUNT=0，提供 manual() 函数，支付/退款回调检查改为环境变量存在性和 https 校验，输出 MANUAL 标记，MANUAL 不计入 FAIL，仅 FAIL_COUNT > 0 时 exit 1。

### Requirement: deploy-preprod.sh 预生产部署脚本
部署脚本 SHALL 支持 ENV_FILE 参数（默认 ../.env.production），ENV_FILE 不存在时 exit 1，执行 docker compose config 验证，迁移失败 exit 1，输出预生产域名，提示后续 smoke 命令。

### Requirement: 微信审核材料包
项目 SHALL 包含 docs/14_WECHAT_REVIEW_PACKAGE.md，涵盖小程序基础信息、审核账号说明、核心功能说明、支付说明、隐私合规说明、审核备注模板，不包含真实密钥或密码。

### Requirement: RC tag 对齐
项目 SHALL 创建 v1.0.0-rc.2 tag 指向最终质量门禁通过的 commit，RELEASE_CANDIDATE.md 版本号更新为 v1.0.0-rc.2，commit hash 使用完整 hash。

## MODIFIED Requirements

### Requirement: GO_LIVE.md 状态真实性
GO_LIVE.md commit hash SHALL 使用完整 hash，修改记录表和验收记录表 SHALL 新增本次记录，未实际完成的验收项不得勾选。

### Requirement: RELEASE_CANDIDATE.md 状态真实性
RELEASE_CANDIDATE.md commit hash SHALL 使用完整 hash，构建时间 SHALL 为真实时间，已知 WARN SHALL 反映真实结果。
