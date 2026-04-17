# 架构与稳定性修复 Spec

## Why
当前仓库虽可演示，但存在硬编码敏感信息、并发安全漏洞、全表扫描性能隐患、奖励发放非原子性、前后端接口不对齐、逻辑删除活动可被读取、重复代码、文档缺失等问题，不适合进入公开测试和上线。需要系统性修复，使仓库进入更可靠的测试版状态。

## What Changes
- 引入 .env / .env.example 机制，docker-compose.yml 和 uni-app 不再硬编码敏感配置
- ActivityService 报名/取消使用事务+行锁，防止并发超报名和计数漂移
- 用户表增加 invite_code 字段并建唯一索引，邀请码查询改为直接索引查询
- InviteService.GrantReward 使用事务保证原子性，OrderService 首单奖励异常不再静默吞掉
- 活动详情页前后端接口契约对齐，移除 mock 默认数据，未实现功能诚实标注
- ActivityDetail 查询增加 is_enable/is_delete_time 过滤
- App.vue 删除重复的 group_arry 方法定义
- 新增4份修复说明文档

## Impact
- Affected code: docker-compose.yml, .env.example, .gitignore, shopxo-uniapp/App.vue, shopxo-uniapp/pages/activity-detail/activity-detail.vue, shopxo-uniapp/pages/activity-signup/activity-signup.vue, shopxo-backend/app/service/ActivityService.php, shopxo-backend/app/service/InviteService.php, shopxo-backend/app/service/OrderService.php, shopxo-backend/app/api/controller/Activity.php, shopxo-backend/app/service/UserService.php
- Affected DB: sxo_user 表新增 invite_code 字段+唯一索引
- Affected docs: 新增4份文档

## ADDED Requirements

### Requirement: 配置安全管理
系统 SHALL 不在代码中硬编码敏感配置（数据库密码、局域网IP等），使用环境变量机制管理。

#### Scenario: Docker Compose 启动
- **WHEN** 执行 docker-compose up
- **THEN** MySQL 密码、端口等从 .env 文件读取，不使用硬编码值

#### Scenario: uni-app 请求地址配置
- **WHEN** 小程序启动时
- **THEN** request_url 从独立开发配置文件读取，不硬编码局域网 IP

#### Scenario: 新人 clone 项目
- **WHEN** 新开发者 clone 项目后
- **THEN** 按 .env.example 填写配置即可完成本地开发环境搭建

### Requirement: 活动报名并发安全
系统 SHALL 保证活动报名和取消在并发场景下数据一致性。

#### Scenario: 多人同时报名同一活动
- **WHEN** 多个用户并发报名同一活动
- **THEN** 报名人数不会超过 max_count，signup_count 与有效报名记录数一致

#### Scenario: 并发取消报名
- **WHEN** 多个用户并发取消报名
- **THEN** signup_count 准确递减，不会出现负数或漂移

### Requirement: 邀请码索引查询
系统 SHALL 使用 invite_code 字段直接查询邀请人，不允许全表扫描。

#### Scenario: 通过邀请码查找邀请人
- **WHEN** 用户使用邀请码注册
- **THEN** 系统通过 invite_code 唯一索引直接定位邀请人，不遍历全表

#### Scenario: 老用户邀请码补齐
- **WHEN** 执行迁移脚本后
- **THEN** 所有老用户自动生成唯一 invite_code

### Requirement: 邀请奖励发放原子性
系统 SHALL 保证邀请奖励发放的原子性和幂等性。

#### Scenario: 奖励发放
- **WHEN** 触发奖励发放
- **THEN** 积分增加、积分日志、奖励状态更新在同一事务中完成，同一条奖励不会重复发放

#### Scenario: 首单奖励异常
- **WHEN** 首单奖励发放失败
- **THEN** 系统记录可追踪日志，不中断主订单流程，不静默吞异常

### Requirement: 前后端接口契约一致
系统 SHALL 保证活动详情页前端读取字段与后端返回结构完全对齐。

#### Scenario: 打开活动详情页
- **WHEN** 用户打开活动详情页
- **THEN** 页面内容来自真实接口数据，接口结构与前端读取逻辑一致

#### Scenario: 未实现功能
- **WHEN** 前端功能无后端支持（如收藏、点赞、评论、海报）
- **THEN** 页面不伪装成已实现，而是隐藏入口、禁用按钮或显示"暂未开放"

### Requirement: 逻辑删除活动不可读取
系统 SHALL 确保逻辑删除和已禁用的活动不能通过详情接口读取。

#### Scenario: 访问已删除活动
- **WHEN** 通过活动详情接口访问 is_delete_time != 0 或 is_enable = 0 的活动
- **THEN** 接口返回"活动不存在"

### Requirement: App.vue 无重复代码
系统 SHALL 不包含重复定义的方法。

#### Scenario: group_arry 方法
- **WHEN** App.vue 加载时
- **THEN** group_arry 方法只定义一次，无重复定义

## MODIFIED Requirements
无

## REMOVED Requirements
无
