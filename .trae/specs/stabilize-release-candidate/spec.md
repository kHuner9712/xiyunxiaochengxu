# Release Candidate 稳定化修复 Spec

## Why
当前代码已完成6个阶段的功能开发并合入主分支，但存在路由冲突、BigInt转换异常、事务一致性、权限缺失等高风险问题。需要修复这些问题，将代码从"功能已写入"推进到"可进入人工真机验收"的候选版本。

## What Changes
- **P0-1**: 修复 `/weapp/activity/feed` 路由冲突 — 将 feed 接口迁移到 ActivityModule 内
- **P0-2**: 修复分享访问记录接口未登录不可用 — POST /weapp/share/visit 添加 @Public()
- **P0-3**: 修复裂变注册奖励 sourceId BigInt 转换异常 — 使用 relation.id 作为 sourceId
- **P0-4**: 修复自提订单创建事务一致性 — 自提点快照在 order.create 中一次性写入，验证自提点存在且启用
- **P0-5**: 检查 PaymentService 循环依赖 — 确认 forwardRef 正确使用
- **P1-1**: 更新 GO_LIVE.md 状态
- **P1-2**: 检查权限 seed 完整性
- **P1-3**: 统一小程序分享参数解析工具
- **P1-4**: 检查活动页 FeedItem 契约一致性
- **P1-5**: 修复客服配置 enabled 返回类型
- 补充 e2e/unit 测试覆盖所有 P0 修复
- 运行完整质量门禁

## Impact
- Affected code: activity controller, content controller, share controller/service, order service, payment module, system-config service, miniprogram App.vue, GO_LIVE.md, seed.ts

## ADDED Requirements

### Requirement: Activity Feed 路由安全
系统 SHALL 将 /weapp/activity/feed 路由注册在 ActivityModule 的 WeappActivityController 中，确保 @Get('feed') 在 @Get(':id') 之前声明，避免 'feed' 被 :id 参数捕获。

#### Scenario: feed 路由不被 :id 捕获
- **WHEN** GET /api/weapp/activity/feed?tab=recommend
- **THEN** 返回 200 和 feed 数据，不触发 findById('feed')

### Requirement: 分享访问记录公开访问
系统 SHALL 允许未登录用户调用 POST /weapp/share/visit。

#### Scenario: 未登录访问记录
- **WHEN** 未登录用户 POST /api/weapp/share/visit
- **THEN** 返回 200，访问记录成功

### Requirement: 裂变奖励 sourceId 安全
系统 SHALL 使用纯数字 BigInt 作为 pointsRecord.sourceId，不允许将带字符串前缀的值转为 BigInt。

#### Scenario: 注册奖励幂等
- **WHEN** 新用户绑定邀请关系
- **THEN** 使用 UserInviteRelation.id 作为 sourceId，source='invitee_register'
- **AND** 重复调用不重复发放

### Requirement: 自提订单事务一致性
系统 SHALL 在创建自提订单的事务内验证自提点存在且启用，并将自提点快照字段一次性写入 order.create。

#### Scenario: 自提点不存在
- **WHEN** pickupStoreId 对应的自提点不存在或已停用
- **THEN** 创建订单失败，不产生任何订单记录

#### Scenario: 自提点快照写入
- **WHEN** 自提订单创建成功
- **THEN** pickupStoreId/pickupStoreName/pickupStoreAddress/pickupContactPhone 在同一事务内写入

### Requirement: 客服配置 enabled 类型
系统 SHALL 将 customer_service.enabled 返回为 boolean 类型，不是字符串 'true'/'false'。

## MODIFIED Requirements

### Requirement: GO_LIVE.md 状态更新
GO_LIVE.md SHALL 反映当前真实测试数量、migration 数量、release-check 结果，并新增自提/客服/裂变/活动feed验收项。

## REMOVED Requirements
无删除项。本阶段不新增业务功能。
