# 禧孕 V1.0 用户数据删除/匿名化处理流程

---

## 一、概述

本文档描述禧孕平台处理用户数据删除/匿名化请求的完整流程，确保符合《个人信息保护法》要求。

## 二、用户申请入口

| 入口 | 位置 | 说明 |
|------|------|------|
| 反馈提交 | 小程序 → 反馈 → 类型选择"数据删除/隐私请求" | 用户提交申请，后台审核 |
| 联系客服 | 小程序 → 设置 → 客服电话 | 用户口头申请 |
| 隐私政策 | 小程序 → 关于我们 → 隐私政策 → 第五章"您的权利" | 说明申请方式 |

## 三、后台处理流程

### 3.1 查找用户

1. 登录后台 → 禧孕运营 → 隐私数据管理
2. 通过用户 ID / 手机号 / openid 搜索用户
3. 系统展示用户关联数据（默认脱敏）：
   - 用户基础资料（昵称、手机号、孕育阶段、预产期、宝宝生日）
   - 活动报名记录
   - 反馈记录
   - 邀请关系
   - 订单记录

### 3.2 执行匿名化

**前置条件：**
- 操作人必须是超级管理员或拥有 `muyingprivacy/delete` 权限
- 必须二次确认操作

**匿名化处理范围：**

| 数据项 | 处理方式 |
|--------|----------|
| 用户昵称 | 改为"已注销用户" |
| 用户地址（province/city/county/address） | 清空 |
| 手机号 | 策略见下方"手机号处理策略" |
| current_stage | 清空 |
| due_date | 清零 |
| baby_birthday | 清零 |
| 活动报名姓名（所有状态） | 替换为加密的"已注销用户" |
| 活动报名手机号（所有状态） | 替换为加密的"ANONYMIZED" + 重新 hash |
| 反馈联系方式 | 清空 |
| 反馈联系方式 hash | 清空 |
| 邀请注册奖励 | 状态改为已失效（status=2） |
| 用户收货地址（sxo_user_address） | 姓名/电话/地址/别名清空 |
| 已完成/已取消/已关闭订单地址（sxo_order_address） | 姓名/电话/地址/自提联系人/身份证信息清空 |

**不处理的数据：**

| 数据项 | 原因 |
|--------|------|
| 进行中订单地址（status 0-3） | 保障履约/配送/售后不中断 |
| 订单主记录（sxo_order） | 财务/售后链路需要，不可删除 |
| 用户 ID | 保留用于订单关联 |

### 3.2a 手机号处理策略

| 条件 | 处理方式 | 说明 |
|------|----------|------|
| 无进行中订单 | mobile 清空 | 用户无法再通过手机号登录，但可通过微信授权登录 |
| 有进行中订单（status 0-3） | mobile 保留 | 保障履约/配送/售后联系，审计日志记录保留原因 |

**留存依据**：进行中订单需要手机号用于配送联系、售后沟通、短信通知等。订单完成后可再次执行匿名化清空 mobile。

**对登录的影响**：清空 mobile 后，用户无法通过短信登录和手机号密码登录，但仍可通过微信授权登录（openid 不受影响）。

### 3.3 操作权限

| 权限 | 说明 |
|------|------|
| 超级管理员（id=1） | 可执行匿名化 |
| muyingprivacy/delete 权限 | 可执行匿名化 |
| 其他角色 | 不可见匿名化按钮 |

### 3.4 审计日志

每次匿名化操作自动记录审计日志：
- 操作管理员 ID 和用户名
- 操作场景：data_anonymize
- 目标用户 ID
- 匿名化统计：signups/feedbacks/invites/mobile_action/order_addr_masked
- 保留原因（如有）
- 操作时间
- 操作 IP
- **不记录明文手机号、姓名、地址**

### 3.5 匿名化结果统计

AnonymizeUser 返回 data 包含：

| 字段 | 说明 |
|------|------|
| user_updated | 用户基础资料是否更新（1=是） |
| signups_updated | 活动报名匿名化数量（含所有状态） |
| feedbacks_updated | 反馈联系方式清空数量 |
| invites_disabled | 邀请奖励失效数量 |
| user_addresses_cleared | 用户收货地址清空数量 |
| order_addresses_masked | 订单地址脱敏数量（仅已完成/已取消/已关闭） |
| orders_retained | 订单保留数量（全部） |
| mobile_action | mobile 处理方式（cleared/retained） |
| retained_reason | mobile 保留原因（如有） |

## 四、处理时效

- 收到申请后 15 个工作日内完成处理
- 处理完成后通过反馈系统回复用户

## 五、数据库迁移

执行以下 SQL 文件以启用此功能：

1. `docs/sql/muying-feedback-type-migration.sql` — 反馈表增加 type 字段
2. `docs/sql/muying-privacy-power-migration.sql` — 后台菜单权限注册

## 六、相关文件

| 文件 | 说明 |
|------|------|
| `shopxo-backend/app/service/MuyingDataAnonymizeService.php` | 数据匿名化核心服务 |
| `shopxo-backend/app/admin/controller/Muyingprivacy.php` | 后台隐私数据管理控制器 |
| `shopxo-backend/app/admin/view/default/muyingprivacy/index.html` | 后台隐私数据管理页面 |
| `shopxo-uniapp/pages/feedback-submit/feedback-submit.vue` | 小程序反馈提交页（含隐私请求类型） |
| `shopxo-uniapp/pages/agreement/agreement.vue` | 隐私政策（含数据删除说明） |
| `shopxo-uniapp/pages/about/about.vue` | 关于我们（含数据删除申请入口） |
