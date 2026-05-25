# Tasks

- [x] Task 1: P0-1 修复 Activity Feed 路由冲突
  - [x] 1.1: 将 WeappActivityFeedController 从 content.controller.ts 移除
  - [x] 1.2: 在 activity.controller.ts 的 WeappActivityController 中添加 @Get('feed')，确保在 @Get(':id') 之前
  - [x] 1.3: ActivityService 注入 ContentService 或新建 ActivityFeedService，调用 findActivityFeed
  - [x] 1.4: ActivityModule 导入 ContentModule 或新 Service
  - [x] 1.5: ContentModule 不再导出 WeappActivityFeedController
  - [ ] 1.6: 补充 e2e 测试：GET /api/weapp/activity/feed 返回 200，不被 :id 捕获

- [x] Task 2: P0-2 修复分享访问记录 @Public()
  - [x] 2.1: 在 share.controller.ts 的 POST visit 方法上添加 @Public() 装饰器
  - [ ] 2.2: 补充测试：未登录 POST /api/weapp/share/visit 成功，POST /api/weapp/share/bind-invite 返回 401

- [x] Task 3: P0-3 修复裂变注册奖励 sourceId BigInt 风险
  - [x] 3.1: 修改 share.service.ts processInviteeReward，sourceId 使用 relation.id（纯 BigInt）
  - [x] 3.2: 修改 bindInvite 方法，将 relation 对象传递给 processInviteeReward
  - [x] 3.3: 首单奖励 sourceId 继续使用 orderId，确认无 BigInt 转换异常
  - [ ] 3.4: 补充测试：注册奖励幂等、sourceId 无 BigInt 异常、campaign 过期不发

- [x] Task 4: P0-4 修复自提订单创建事务一致性
  - [x] 4.1: 在 order.service.ts create 方法中，fulfillmentType='pickup' 时先查询自提点验证存在且启用
  - [x] 4.2: 在 tx.order.create 的 data 中一次性写入 pickupStoreId/pickupStoreName/pickupStoreAddress/pickupContactPhone
  - [x] 4.3: 确认 pickupCode 在支付成功后生成，generatePickupCode 有循环查重
  - [ ] 4.4: 补充测试：pickupStoreId 不存在时失败、禁用时失败、快照写入、pickupCode 生成

- [x] Task 5: P0-5 检查 PaymentService 循环依赖
  - [x] 5.1: 确认 PaymentModule 使用 forwardRef(() => OrderModule)
  - [x] 5.2: 确认 PaymentService 构造函数 OrderService 参数使用 @Inject(forwardRef(...))
  - [ ] 5.3: 运行 pnpm build:api 确认无启动错误

- [ ] Task 6: P1-1 更新 GO_LIVE.md
  - [ ] 6.1: 更新测试数量、migration 数量、release-check 结果为真实值
  - [ ] 6.2: 新增自提/客服/裂变/活动feed验收项
  - [ ] 6.3: 未执行的真机测试不勾选

- [ ] Task 7: P1-2 检查权限 seed 完整性
  - [ ] 7.1: 确认 seed.ts 包含所有新增权限码
  - [ ] 7.2: 确认超级管理员角色拥有新增权限
  - [ ] 7.3: 确认 seed 可重复执行不重复插入

- [x] Task 8: P1-3 统一小程序分享参数解析
  - [x] 8.1: 新建 utils/share.ts 统一分享参数解析和 recordVisit/bindInvite 调用
  - [x] 8.2: 修改 App.vue 使用统一工具
  - [x] 8.3: 确认各页面 onShareAppMessage 携带 inviter 参数

- [ ] Task 9: P1-4 检查活动页 FeedItem 契约
  - [ ] 9.1: 对比后端 findActivityFeed 返回字段与前端 FeedItem 接口
  - [ ] 9.2: 确保 id 类型统一为 string
  - [ ] 9.3: 确保 goDetail 跳转路径正确

- [x] Task 10: P1-5 修复客服配置 enabled 类型
  - [x] 10.1: 修改 system-config.service.ts getCustomerServiceConfig，enabled 返回 boolean
  - [ ] 10.2: 补充测试：enabled 为 boolean 类型

- [ ] Task 11: 补充后端测试
  - [ ] 11.1: Activity Feed e2e 测试（feed 路由、tab 过滤）
  - [ ] 11.2: Pickup 完整测试（自提点验证、快照写入、pickupCode、核销、重复核销）
  - [ ] 11.3: Share 完整测试（visit public、bind-invite auth、BigInt安全、幂等）
  - [ ] 11.4: Customer Service 测试（enabled boolean、public 接口）
  - [ ] 11.5: Payment 测试（delivery→pending_delivery、pickup→pending_pickup、幂等）

- [ ] Task 12: 小程序端联调检查
  - [ ] 12.1: 检查所有页面 TS 类型无错误
  - [ ] 12.2: 检查所有 API 返回字段与后端统一
  - [ ] 12.3: 检查所有跳转路径在 pages.json 中存在

- [ ] Task 13: 管理后台联调检查
  - [ ] 13.1: 检查 API 路径与后端一致
  - [ ] 13.2: 检查权限码一致
  - [ ] 13.3: 检查页面构建通过

- [ ] Task 14: 运行完整质量门禁
  - [ ] 14.1: pnpm install
  - [ ] 14.2: prisma:validate + prisma:generate
  - [ ] 14.3: test:ci
  - [ ] 14.4: build:api + build:admin + build:mini
  - [ ] 14.5: release:check

- [ ] Task 15: 更新文档
  - [ ] 15.1: 更新 GO_LIVE.md
  - [ ] 15.2: 更新 docs/07_API_SPEC.md
  - [ ] 15.3: 更新 docs/12_ACCEPTANCE_CHECKLIST.md

- [ ] Task 16: 提交并推送到 GitHub

# Task Dependencies
- Task 1 (Activity Feed路由) → Task 11.1 (Feed e2e测试)
- Task 2 (Share @Public) → Task 11.3 (Share测试)
- Task 3 (BigInt修复) → Task 11.3 (Share测试)
- Task 4 (自提事务) → Task 11.2 (Pickup测试)
- Task 5 (循环依赖) → Task 14 (质量门禁)
- Task 10 (客服类型) → Task 11.4 (客服测试)
- Task 6,7,8,9,12,13 可与 Task 1-5 并行
- Task 14 依赖所有修复完成
- Task 15 依赖 Task 14 通过
- Task 16 依赖 Task 15 完成
