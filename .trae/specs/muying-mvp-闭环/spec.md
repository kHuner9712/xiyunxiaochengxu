# 母婴商城 MVP 闭环 Spec

## Why
一期前端页面和后端 API 已完成，但管理后台缺失、活动无法发布、邀请钩子未接入、整体流程无法跑通。需要补齐"活动发布→用户报名→后台管理→签到核销→邀请裂变→优惠券发放"完整闭环，形成可演示和试运营的 MVP。

## What Changes
- 新增活动管理后台（控制器+视图+权限菜单）
- 新增报名管理后台（含签到/核销/导出）
- 新增邀请关系管理后台
- 补充活动类型（6种）和报名表单字段（预产期/宝宝月龄动态显示）
- 接入邀请钩子到注册和首单流程
- 优惠券发放与邀请奖励联动
- 隐藏一期不需要的后台功能（多商户/分销等）
- 统一母婴阶段枚举
- 预留数据指标统计口径
- 生成4份文档

## Impact
- Affected code:
  - shopxo-backend: 新增 admin 控制器2个、admin 视图6+个、权限菜单SQL、Service补充、钩子接入
  - shopxo-uniapp: 活动详情页增强、报名表单动态字段、前端API对接（替换mock）
- Affected systems: 数据库（sxo_power菜单+活动表字段补充）、权限系统、缓存

## ADDED Requirements

### Requirement: 活动管理后台
系统 SHALL 提供活动管理后台，支持活动的增删改查、上下架、排序。

#### Scenario: 管理员创建活动
- **WHEN** 管理员在后台点击"添加活动"
- **THEN** 显示活动编辑表单（标题/封面/分类/阶段/时间/地点/人数/价格/详情），提交后活动创建成功

#### Scenario: 管理员管理活动列表
- **WHEN** 管理员访问活动管理页面
- **THEN** 显示活动列表，支持筛选/搜索/分页，可编辑/删除/上下架

### Requirement: 报名管理后台
系统 SHALL 提供报名管理后台，支持查看报名记录、签到核销、导出数据。

#### Scenario: 查看报名记录
- **WHEN** 管理员查看某活动的报名列表
- **THEN** 显示报名记录（姓名/手机/阶段/状态/报名时间），支持按状态筛选

#### Scenario: 签到核销
- **WHEN** 管理员对某条报名记录点击"签到"
- **THEN** 报名状态变为"已签到"，signup_count不变

#### Scenario: 导出报名数据
- **WHEN** 管理员点击"导出"按钮
- **THEN** 下载CSV/Excel格式的报名数据

### Requirement: 邀请关系管理后台
系统 SHALL 提供邀请关系查看和奖励管理功能。

#### Scenario: 查看邀请关系
- **WHEN** 管理员访问邀请管理页面
- **THEN** 显示邀请关系列表（邀请人/被邀请人/注册时间/奖励状态）

### Requirement: 活动类型扩展
系统 SHALL 支持6种活动类型：孕妈课堂、线下沙龙、育儿讲座、试用官招募、节日活动、签到打卡活动。

#### Scenario: 活动类型选择
- **WHEN** 管理员创建活动选择分类
- **THEN** 可选择6种活动类型

### Requirement: 报名表单动态字段
系统 SHALL 根据用户选择的阶段动态显示预产期或宝宝月龄字段。

#### Scenario: 孕期用户报名
- **WHEN** 用户选择"孕期"阶段
- **THEN** 显示"预产期"日期选择器

#### Scenario: 产后用户报名
- **WHEN** 用户选择"产后"阶段
- **THEN** 显示"宝宝月龄"选择器

### Requirement: 邀请钩子接入
系统 SHALL 在用户注册和首单完成时触发邀请奖励。

#### Scenario: 注册触发奖励
- **WHEN** 新用户通过邀请码注册成功
- **THEN** 自动调用 InviteService::OnUserRegister()，给邀请人发放积分/优惠券

#### Scenario: 首单触发奖励
- **WHEN** 被邀请用户完成首单支付
- **THEN** 自动调用 InviteService::OnFirstOrder()，给邀请人发放额外积分/优惠券

### Requirement: 一期功能隐藏
系统 SHALL 在后台隐藏多商户、商家入驻、多级分销、重社区、医疗咨询、复杂直播、复杂积分商城等功能入口。

#### Scenario: 后台菜单精简
- **WHEN** 管理员登录后台
- **THEN** 不显示多商户/商家入驻/分销/直播等菜单项

### Requirement: 统一母婴阶段枚举
系统 SHALL 使用统一的阶段枚举常量，避免散落硬编码。

#### Scenario: 阶段枚举定义
- **WHEN** 代码中需要使用阶段值
- **THEN** 引用统一常量 MuyingStage::PREPARE / MuyingStage::PREGNANCY / MuyingStage::POSTPARTUM / MuyingStage::ALL

### Requirement: 数据指标预留
系统 SHALL 在后台或文档中预留6个统计口径：注册转化率、阶段资料完善率、活动报名转化率、商品支付转化率、复购率、邀请带新率。

#### Scenario: 简版数据报表
- **WHEN** 管理员访问数据报表页面
- **THEN** 显示6个核心指标的当前值和趋势

## MODIFIED Requirements

### Requirement: 活动详情页增强
原活动详情页需增加：适合人群、分享海报入口、报名表单动态字段。

### Requirement: 报名表单
原报名表单需增加：预产期（孕期动态显示）、宝宝月龄（产后动态显示）。

## REMOVED Requirements
无（仅隐藏不删除）
