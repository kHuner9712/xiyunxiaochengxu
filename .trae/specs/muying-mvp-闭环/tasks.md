# Tasks

- [x] Task 1: 统一母婴阶段枚举 + 数据库补充
  - [x] SubTask 1.1: 创建 app/extend/muying/MuyingStage.php 枚举类（PREPARE/PREGNANCY/POSTPARTUM/ALL + 映射 + 校验）
  - [x] SubTask 1.2: 补充 sxo_activity 表字段（category枚举值6种 + suitable_crowd 字段）
  - [x] SubTask 1.3: 补充 sxo_activity_signup 表字段（due_date/baby_month_age/checkin_status/checkin_time）
  - [x] SubTask 1.4: 数据库迁移SQL已就绪（需手动执行）

- [x] Task 2: 活动管理后台
  - [x] SubTask 2.1: 创建 app/admin/controller/Activity.php 控制器（完整实现）
  - [x] SubTask 2.2: 创建 app/admin/form/Activity.php 表格配置（列定义+筛选条件完整）
  - [x] SubTask 2.3: 创建 activity/saveinfo.html 活动编辑视图（完整）
  - [x] SubTask 2.4: 创建 activity/detail.html 活动详情视图
  - [x] SubTask 2.5: 权限菜单SQL已写入 muying-mvp-migration.sql（需手动执行）
  - [ ] SubTask 2.6: 清除权限缓存使菜单生效（需手动执行）

- [x] Task 3: 报名管理后台
  - [x] SubTask 3.1: 创建 Activitysignup.php 控制器（完整实现）
  - [x] SubTask 3.2: 创建 app/admin/form/Activitysignup.php 表格配置（列定义+筛选条件完整）
  - [x] SubTask 3.3: 创建 activitysignup/detail.html 报名详情视图
  - [x] SubTask 3.4: 实现签到核销功能
  - [x] SubTask 3.5: 实现导出功能（CSV格式）
  - [x] SubTask 3.6: 权限菜单SQL已写入 muying-mvp-migration.sql

- [x] Task 4: 邀请关系管理后台
  - [x] SubTask 4.1: 补全 Invite.php 控制器（含Service调用和数据传递）
  - [x] SubTask 4.2: 补全 invite/index.html + app/admin/form/Invite.php（表格配置完整）
  - [x] SubTask 4.3: 权限菜单SQL已写入 muying-mvp-migration.sql

- [x] Task 5: 简版数据报表
  - [x] SubTask 5.1: 创建 Muyingstat.php 控制器
  - [x] SubTask 5.2: 创建 muyingstat/index.html 报表视图（6个核心指标卡片）
  - [x] SubTask 5.3: 创建 MuyingStatService.php 统计服务
  - [x] SubTask 5.4: 权限菜单SQL已写入 muying-mvp-migration.sql

- [x] Task 6: 邀请钩子接入
  - [x] SubTask 6.1: UserService::Reg() 已接入 InviteService::OnUserRegister()
  - [x] SubTask 6.2: OrderService 首单支付已接入 InviteService::OnFirstOrder()
  - [x] SubTask 6.3: 邀请码传递链路已验证（invite_code → UserService::Reg → InviteService）

- [x] Task 7: 前端活动报名增强
  - [x] SubTask 7.1: ActivityService::ActivitySignup 已保存 due_date/baby_month_age 字段
  - [x] SubTask 7.2: 前端API字段名已修复（invite.vue: total_invites→invite_count, total_rewards→reward_total）
  - [x] SubTask 7.3: activity-detail.vue 已有适合人群和分享海报入口（海报/收藏/点赞为前端mock，待后续完善）
  - [x] SubTask 7.4: invite.vue 已对接真实API

- [x] Task 8: 后台功能隐藏
  - [x] SubTask 8.1: 功能隐藏SQL已写入 muying-mvp-migration.sql（需手动执行）
  - [ ] SubTask 8.2: 清除权限缓存（需手动执行）

- [x] Task 9: 最小可演示数据
  - [x] SubTask 9.1: 插入6种类型的活动演示数据（各1条）
  - [x] SubTask 9.2: 插入报名演示数据（5条，含不同状态）
  - [x] SubTask 9.3: 插入邀请关系演示数据（3条）

- [x] Task 10: 文档产出
  - [x] SubTask 10.1: 生成 /docs/20-活动报名与核销实现说明.md
  - [x] SubTask 10.2: 生成 /docs/21-后台菜单与权限调整.md
  - [x] SubTask 10.3: 生成 /docs/22-邀请裂变逻辑说明.md
  - [x] SubTask 10.4: 生成 /docs/23-MVP联调与演示路径.md

# Task Dependencies
- Task 1（枚举+数据库）已完成
- Task 2-4（管理后台）已完成
- Task 5（数据报表）已完成
- Task 6（邀请钩子）已完成
- Task 7（前端增强）已完成
- Task 8（功能隐藏）SQL已就绪，需手动执行
- Task 9（演示数据）SQL已就绪，需手动执行
- Task 10（文档）已完成

# 手动执行步骤
1. 执行 muying-migration.sql（建表）
2. 执行 muying-mvp-migration.sql（补充字段+权限菜单+功能隐藏）
3. 执行 muying-demo-data.sql（演示数据）
4. 清除权限缓存
5. 给管理员角色分配新增权限
