# 预生产部署准备 + 真机验收执行包 Spec

## Why
V1.0 RC 代码已稳定（337 tests, 43/0/2 release-check），但部署配置、验收文档、smoke 脚本仍停留在旧状态，缺少自提/客服/裂变/活动feed的覆盖。需要将项目整理成"可部署、可验收、可回滚、可交付"的预生产候选版本。

## What Changes
- 修正 GO_LIVE.md 与验收文档漂移（个人中心/支付状态/数据准备等）
- 补齐 .env.example 缺失变量（UPLOAD_PUBLIC_URL, REFRESH_TOKEN_SECRET 等）
- 完善 env.validation.ts 生产环境校验（WECHAT_SKIP_VERIFY 禁止 true）
- 新增 smoke-preprod.sh 覆盖所有 V1.0 API 端点
- 新增 docs/13_MANUAL_ACCEPTANCE_GUIDE.md 真机验收执行手册
- 新增 RELEASE_CANDIDATE.md 代码冻结材料
- 检查 seed.ts 幂等性和权限完整性
- 安全扫描确认无真实密钥提交

## Impact
- Affected docs: GO_LIVE.md, docs/07_API_SPEC.md, docs/10_ORDER_PAYMENT_AFTERSALE.md, docs/12_ACCEPTANCE_CHECKLIST.md
- Affected scripts: deploy/scripts/smoke-preprod.sh (新建)
- Affected config: .env.example, env.validation.ts
- Affected seed: apps/api/prisma/seed.ts

## ADDED Requirements

### Requirement: 预生产 Smoke Test 覆盖 V1.0 全部 API
系统 SHALL 提供 smoke-preprod.sh 脚本，覆盖 health/home/product/activity-feed/content/pickup-store/customer-service/share-visit 等端点。

#### Scenario: smoke test 覆盖活动 feed
- **WHEN** 执行 smoke-preprod.sh
- **THEN** GET /api/weapp/activity/feed?tab=recommend 返回 200

### Requirement: 真机验收执行手册
系统 SHALL 提供 docs/13_MANUAL_ACCEPTANCE_GUIDE.md，覆盖小程序验收路径、后台验收路径、支付退款专项验收。

### Requirement: 代码冻结材料
系统 SHALL 提供 RELEASE_CANDIDATE.md，包含 RC 版本号、commit hash、功能范围、测试结果、回滚方案。

## MODIFIED Requirements

### Requirement: GO_LIVE.md 验收项更新
GO_LIVE.md SHALL 修正以下漂移：
- 个人中心验收：删除"内容/育儿知识正常"，改为"活动板块文章/视频内容流正常"+"我的页面客服与帮助入口正常"
- 支付专项验收：拆分为快递/自提两种状态流转
- 数据准备 checklist：新增自提点/客服配置/裂变活动/视频内容等

### Requirement: .env.example 完整性
.env.example SHALL 包含 UPLOAD_PUBLIC_URL 和 REFRESH_TOKEN_SECRET 等缺失变量。

### Requirement: env.validation.ts 生产安全
env.validation.ts SHALL 在 production 环境下禁止 WECHAT_SKIP_VERIFY=true。

## REMOVED Requirements
无删除项。本阶段不新增业务功能。
