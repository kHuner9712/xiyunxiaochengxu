# Tasks

- [x] Task 1: 配置安全整改 - 引入 .env 机制，消除硬编码敏感信息
  - [x] 1.1 创建根目录 .env.example
  - [x] 1.2 修改 docker-compose.yml
  - [x] 1.3 更新 .gitignore
  - [x] 1.4 创建 shopxo-uniapp/common/js/config/dev.js
  - [x] 1.5 修改 App.vue
  - [x] 1.6 更新 shopxo-backend/.env.example

- [x] Task 2: 活动报名并发安全修复
  - [x] 2.1 修改 ActivityService::ActivitySignup
  - [x] 2.2 修改 ActivityService::SignupCancel
  - [x] 2.3 增加 RecalculateSignupCount

- [x] Task 3: 邀请码重构 - 从 md5 规则改为数据库字段+唯一索引
  - [x] 3.1 创建 SQL 迁移文件
  - [x] 3.2 创建老数据补齐脚本
  - [x] 3.3 修改 InviteService::InviteInfo
  - [x] 3.4 修改 InviteService::GetInviterByCode
  - [x] 3.5 修改 InviteService::Poster
  - [x] 3.6 修改 UserService 注册流程
  - [x] 3.7 修改 InviteService::OnUserRegister

- [x] Task 4: 邀请奖励发放原子性修复
  - [x] 4.1 修改 InviteService::GrantReward
  - [x] 4.2 修改 OrderService 首单奖励 try-catch
  - [x] 4.3 修改 UserService 注册邀请钩子 try-catch

- [x] Task 5: 活动详情页前后端接口契约对齐
  - [x] 5.1 修改 Activity.php Detail 接口
  - [x] 5.2 修改 activity-detail.vue
  - [x] 5.3 修改 activity-detail.vue 回调逻辑
  - [x] 5.4 未实现功能标注"暂未开放"
  - [x] 5.5 修改 activity-signup.vue

- [x] Task 6: 已删除活动过滤修复
  - [x] 6.1 修改 ActivityService::ActivityDetail
  - [x] 6.2 修改 Activity.php Detail 接口

- [x] Task 7: App.vue 重复代码清理
  - [x] 7.1 删除重复 group_arry 方法
  - [x] 7.2 检查其他重复逻辑

- [x] Task 8: 文档补齐
  - [x] 8.1 创建 docs/60-配置安全整改说明.md
  - [x] 8.2 创建 docs/61-活动报名并发修复说明.md
  - [x] 8.3 创建 docs/62-邀请码与奖励机制重构说明.md
  - [x] 8.4 创建 docs/63-活动详情页接口契约说明.md
