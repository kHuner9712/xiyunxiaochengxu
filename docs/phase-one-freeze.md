# 一期范围冻结文档

> 本文档冻结一期功能范围，作为产品/开发/测试的共同基准。
> 任何超出本文档范围的需求变更，必须走二期规划，不得直接进入一期开发。

| 项目 | 值 |
|------|-----|
| 版本 | v1.0-phase-freeze |
| 冻结日期 | 2026-04-20 |
| 基于框架 | ShopXO v6.8.0 (ThinkPHP 8) + uni-app |
| 定位 | 母婴行业微信商城小程序 — 一期上线版 |

---

## 1. 一期目标

一期只做四件事，按优先级排序：

1. **商城可成交** — 用户能浏览商品、加车、下单、支付、收货
2. **活动可报名** — 用户能看活动、报名、运营能签到/核销
3. **会员可沉淀** — 用户有母婴阶段画像，平台能识别备孕/孕期/产后人群
4. **一级可裂变** — 用户能邀请注册，邀请人能获得积分奖励

一期不追求功能完整度，追求**核心链路跑通 + 可提审 + 可小范围验证**。

---

## 2. 一期必须上线的功能

### 2.1 首页

| 功能 | 状态 | 对应代码 |
|------|------|---------|
| 阶段入口（备孕/孕期/产后） | ✅ 已实现 | `components/stage-nav/stage-nav.vue` |
| 推荐活动（4条） | ✅ 已实现 | `pages/index/index.vue` → `activity/index` |
| 推荐商品（按阶段筛选） | ✅ 已实现 | `pages/index/index.vue` → `search/datalist` |
| 内容资讯/孕育知识 | ✅ 已实现 | `pages/index/index.vue` → `article/datalist` |
| 邀请有礼入口 | ✅ 已实现 | `pages/index/index.vue` |
| Banner/轮播图 | ✅ 已实现 | ShopXO 原生 |
| 🔴 muying 主题色注册 | ❌ 必须修 | `App.vue` `get_theme_color()` 缺 `muying` 条目 |
| 🔴 TabBar 选中态图标 | ❌ 必须补 | `static/images/muying/tabbar/` 缺 4 个图标 |

### 2.2 商城

| 功能 | 状态 | 对应代码 |
|------|------|---------|
| 商品分类浏览 | ✅ 已实现 | ShopXO 原生 |
| 商品搜索+排序 | ✅ 已实现 | ShopXO 原生 |
| 商品详情 | ✅ 已实现 | ShopXO 原生 |
| 商品收藏 | ✅ 已实现 | ShopXO 原生 |
| 加车/下单/支付 | ✅ 已实现 | ShopXO 原生 |
| 母婴阶段标签展示 | ✅ 已实现 | `pages/goods-detail/goods-detail.vue` |
| 卖点标签展示 | ✅ 已实现 | `pages/goods-detail/goods-detail.vue` |
| 🔴 goods.stage/selling_point 数据来源 | ⚠️ 需确认 | 前端已渲染，后端数据来源待确认 |

### 2.3 活动中心

| 功能 | 状态 | 对应代码 |
|------|------|---------|
| 活动列表（阶段+分类筛选） | ✅ 已实现 | `pages/activity/activity.vue` + `ActivityService.php` |
| 活动详情 | ✅ 已实现 | `pages/activity-detail/activity-detail.vue` + `Activity.php` |
| 活动报名（含隐私协议） | ✅ 已实现 | `pages/activity-signup/activity-signup.vue` + `ActivityService.php` |
| 活动收藏 | ✅ 已实现 | `ActivityService::ActivityFavorToggle()` |
| 我的报名列表 | ✅ 已实现 | `pages/my-activity/my-activity.vue` + `ActivityService.php` |
| 🔴 报名页防重复提交 | ❌ 必须修 | `activity-signup.vue` 提交按钮无 loading |
| 🔴 取消报名前端入口 | ❌ 必须补 | 后端 `SignupCancel` 已实现，前端无按钮 |

### 2.4 个人中心

| 功能 | 状态 | 对应代码 |
|------|------|---------|
| 当前阶段显示 | ✅ 已实现 | `pages/user/user.vue` + `MuyingStage` |
| 阶段引导弹窗 | ✅ 已实现 | `components/stage-guide/stage-guide.vue` |
| 阶段/预产期/宝宝生日编辑 | ✅ 已实现 | `pages/personal/personal.vue` |
| 宝宝月龄自动计算 | ✅ 已实现 | `pages/personal/personal.vue` |
| 我的邀请入口 | ✅ 已实现 | `pages/user/user.vue` |
| 我的活动入口 | ✅ 已实现 | `pages/user/user.vue` |

### 2.5 邀请裂变

| 功能 | 状态 | 对应代码 |
|------|------|---------|
| 邀请码生成/展示/复制 | ✅ 已实现 | `pages/invite/invite.vue` + `InviteService.php` |
| 注册奖励（积分） | ✅ 已实现 | `InviteService::OnUserRegister()` |
| 首单奖励（积分） | ✅ 已实现 | `InviteService::OnFirstOrder()` |
| 奖励规则展示 | ✅ 已实现 | `invite/rewardconfigpublic` API |
| 邀请记录列表 | ✅ 已实现 | `pages/invite/invite.vue` → `invite/rewardlist` |
| 小程序分享（带邀请码） | ✅ 已实现 | `onShareAppMessage` |
| 🔴 邀请码 Storage 清理 | ❌ 必须修 | 注册成功后未清理 `invite_code_from_share` |

### 2.6 后台运营

| 功能 | 状态 | 对应代码 |
|------|------|---------|
| 运营菜单（4个二级菜单） | ✅ 已实现 | `muying-final-migration.sql` C6 段 |
| 活动管理 CRUD | ✅ 已实现 | `app/admin/controller/Activity.php` |
| 报名管理（列表/详情/签到/导出） | ✅ 已实现 | `app/admin/controller/Activitysignup.php` |
| 邀请管理（列表/详情） | ✅ 已实现 | `app/admin/controller/Invite.php` |
| 数据看板（6指标） | ✅ 已实现 | `app/admin/controller/Muyingstat.php` |
| 一期无关菜单隐藏 | ✅ 已实现 | `muying-final-migration.sql` C7 段 |

---

## 3. 一期可选但不阻塞上线的功能

| 功能 | 当前状态 | 不阻塞原因 |
|------|---------|-----------|
| 用户反馈提交 | 后端缺 Create API + 管理后台 | 首页展示已有，提交功能可后补 |
| 分类页母婴阶段筛选 | 前端未实现 | 首页已有阶段筛选，分类页可后补 |
| 孕周计算展示 | 前后端均未实现 | 预产期已有，孕周为计算展示，非核心 |
| 报名状态确认（Admin） | 后端无确认操作 | 签到已实现，确认可后补 |
| 统计服务时间筛选 | 后端无时间参数 | 看板全量数据可用，筛选可后补 |
| 活动详情 onShow 刷新 | 前端未实现 | 用户可手动下拉刷新 |
| 隐私协议内容定制 | 使用 ShopXO 默认 | 功能已有，内容可后补 |

---

## 4. 明确延期到二期的功能

| 功能 | 延期原因 | 二期规划建议 |
|------|---------|-------------|
| 多级分佣/二级以上邀请 | 一期只做一级邀请，不做多级分佣 | 二期评估分销体系 |
| 第三方商家入驻 | 一期不做多商户 | 二期评估 `shop` 插件 |
| 重社区/活动评论/点赞 | 一期不做重社区，活动优先于内容互动 | 二期评估 `blog`/`ask` 插件 |
| 会员等级/成长值体系 | 一期商城以可成交为主，不先做复杂会员体系 | 二期评估 `membershiplevelvip` 插件 |
| 关注方向/兴趣标签 | 一期个人画像先保留最必要字段 | 二期评估新增数据模型 |
| 邀请海报图片生成 | 需 Canvas 绘制 + 小程序码，工作量大 | 二期实现 |
| 活动海报生成 | 同上 | 二期实现 |
| 优惠券奖励发放 | 枚举预留 `coupon` 类型，一期不做 | 二期实现 |
| 活动搜索/排序 | 列表量小时不急需 | 二期评估 |
| 内容审核/敏感词过滤 | UGC 量小时可人工审核 | 二期评估接入微信内容安全 API |
| 数据报表趋势图/导出 | 看板够用后迭代 | 二期实现 |
| 多端复杂适配 | 一期以微信小程序为主 | 二期评估 H5/支付宝 |
| 钱包/积分商城 | 一期不做 | 二期评估 `wallet`/`coin` 插件 |
| 直播体系 | 一期不做 | 二期评估 |
| 医疗敏感功能 | 合规风险高 | 需专项评估 |

---

## 5. 当前数据模型必须保留的字段

### 5.1 sxo_activity（活动表）

| 字段 | 类型 | 说明 | 一期必须 |
|------|------|------|---------|
| id | int PK | 主键 | ✅ |
| title | varchar(200) | 活动标题 | ✅ |
| cover | varchar(255) | 封面图 | ✅ |
| content | longtext | 活动详情富文本 | ✅ |
| stage | varchar(50) | 适用阶段（prepare/pregnancy/postpartum/all） | ✅ |
| category | varchar(50) | 活动分类（classroom/salon/lecture/trial/holiday/checkin） | ✅ |
| suitable_crowd | char(255) | 适合人群 | ✅ |
| start_time | datetime | 活动开始时间 | ✅ |
| end_time | datetime | 活动结束时间 | ✅ |
| signup_start_time | datetime | 报名开始时间 | ✅ |
| signup_end_time | datetime | 报名截止时间 | ✅ |
| max_count | int | 最大报名人数（0=不限） | ✅ |
| signup_count | int | 已报名人数 | ✅ |
| price | decimal(10,2) | 活动价格（0=免费） | ✅ |
| address | varchar(500) | 活动地址 | ✅ |
| organizer | varchar(100) | 组织方 | ✅ |
| contact_phone | varchar(20) | 联系电话 | ✅ |
| is_enable | tinyint | 启用状态 | ✅ |
| access_count | int | 访问量 | ✅ |

### 5.2 sxo_activity_signup（报名表）

| 字段 | 类型 | 说明 | 一期必须 |
|------|------|------|---------|
| id | int PK | 主键 | ✅ |
| activity_id | int | 活动ID | ✅ |
| user_id | int | 用户ID | ✅ |
| name | varchar(50) | 报名姓名 | ✅ |
| phone | varchar(20) | 联系电话 | ✅ |
| stage | varchar(50) | 当前阶段 | ✅ |
| due_date | date | 预产期 | ✅ |
| baby_birthday | date | 宝宝生日 | ✅ |
| baby_month_age | int | 宝宝月龄 | ✅ |
| remark | varchar(500) | 备注 | ✅ |
| signup_status | tinyint | 报名状态（0待确认/1已确认/2已取消） | ✅ |
| checkin_status | tinyint | 签到状态（0未签到/1已签到） | ✅ |
| checkin_time | datetime | 签到时间 | ✅ |
| privacy_agreed | tinyint | 隐私协议同意标记 | ✅ |
| privacy_agreed_time | datetime | 隐私协议同意时间 | ✅ |

### 5.3 sxo_invite_reward（邀请奖励表）

| 字段 | 类型 | 说明 | 一期必须 |
|------|------|------|---------|
| id | int PK | 主键 | ✅ |
| inviter_id | int | 邀请人用户ID | ✅ |
| invitee_id | int | 被邀请人用户ID | ✅ |
| event_type | varchar(30) | 事件类型（register/first_order） | ✅ |
| reward_type | varchar(20) | 奖励类型（points/coupon） | ✅ |
| reward_value | int | 奖励值（积分数量） | ✅ |
| reward_status | tinyint | 发放状态（0待发放/1已发放/2已取消） | ✅ |
| reward_time | datetime | 发放时间 | ✅ |
| uk_inviter_invitee_event | unique | 唯一约束（防重复） | ✅ |

### 5.4 sxo_muying_feedback（用户反馈表）

| 字段 | 类型 | 说明 | 一期必须 |
|------|------|------|---------|
| id | int PK | 主键 | ✅ |
| user_id | int | 用户ID | ✅ |
| content | text | 反馈内容 | ✅ |
| stage | varchar(50) | 用户阶段 | ✅ |
| images | text | 图片（JSON数组） | ✅ |
| is_enable | tinyint | 显示状态 | ✅ |

### 5.5 sxo_user 扩展字段

| 字段 | 类型 | 说明 | 一期必须 |
|------|------|------|---------|
| current_stage | varchar(30) | 当前阶段（prepare/pregnancy/postpartum） | ✅ |
| due_date | date | 预产期 | ✅ |
| baby_birthday | date | 宝宝生日 | ✅ |
| invite_code | char(8) | 邀请码 | ✅ |

---

## 6. 当前暂不做的字段和体系

| 字段/体系 | 说明 | 延期原因 |
|----------|------|---------|
| gestation_week（孕周） | 计算值，不需存储，一期也不做展示 | 二期加计算工具 |
| focus_direction（关注方向） | 需新增数据模型 | 二期评估 |
| growth_value（成长值） | 需新增积分累计体系 | 二期评估 |
| user_level（会员等级） | 需等级体系 | 二期评估 |
| invite_level（邀请层级） | 一期只做一级邀请 | 不做多级分佣 |
| commission_rate（佣金比例） | 一期不做分销 | 不做多级分佣 |
| coupon reward_type 发放逻辑 | 枚举预留但一期不实现 | 二期实现 |
| activity_comment（活动评论） | 需新增表 | 一期不做重社区 |
| activity_like（活动点赞） | 需新增表 | 一期不做重社区 |
| store_id（商户ID） | 一期不做多商户 | 二期评估 |

---

## 7. 前台页面范围

### 7.1 一期页面清单

| 页面 | 路径 | 一期状态 |
|------|------|---------|
| 首页 | `/pages/index/index` | ✅ 已实现 |
| 分类 | `/pages/goods-category/goods-category` | ✅ 已实现 |
| 活动 | `/pages/activity/activity` | ✅ 已实现 |
| 活动详情 | `/pages/activity-detail/activity-detail` | ✅ 已实现 |
| 活动报名 | `/pages/activity-signup/activity-signup` | ✅ 已实现 |
| 购物车 | `/pages/cart/cart` | ✅ 已实现 |
| 商品详情 | `/pages/goods-detail/goods-detail` | ✅ 已实现 |
| 个人中心 | `/pages/user/user` | ✅ 已实现 |
| 个人资料 | `/pages/personal/personal` | ✅ 已实现 |
| 邀请有礼 | `/pages/invite/invite` | ✅ 已实现 |
| 我的邀请 | `/pages/my-invite/my-invite` | ✅ 已实现 |
| 我的活动 | `/pages/my-activity/my-activity` | ✅ 已实现 |
| 登录 | `/pages/login/login` | ✅ 已实现 |

### 7.2 一期不新增的页面

| 页面 | 延期原因 |
|------|---------|
| 邀请海报页 | 二期实现图片生成 |
| 活动评论页 | 一期不做重社区 |
| 会员等级页 | 一期不做会员体系 |
| 关注方向设置页 | 二期评估 |
| 积分商城页 | 二期评估 |
| 直播列表页 | 二期评估 |
| 商家入驻页 | 一期不做多商户 |

### 7.3 一期隐藏的插件入口

通过 `phase-one-scope.js` 控制以下插件在前端不可见：

| 插件名 | 说明 |
|--------|------|
| distribution | 分销 |
| wallet | 钱包 |
| coin | 积分商城 |
| shop | 多商户 |
| realstore | 门店 |
| ask | 问答 |
| blog | 博客 |
| membershiplevelvip | 会员等级 |

---

## 8. 后台运营范围

### 8.1 一期已实现的运营功能

| 模块 | 功能 | 菜单路径 |
|------|------|---------|
| 活动管理 | 列表/详情/新增/编辑/删除/启禁用 | 运营 → 活动管理 |
| 报名管理 | 列表/详情/签到/导出CSV | 运营 → 报名管理 |
| 邀请管理 | 列表/详情 | 运营 → 邀请管理 |
| 数据报表 | 6指标看板 | 运营 → 数据报表 |

### 8.2 一期不新增的运营功能

| 功能 | 延期原因 |
|------|---------|
| 反馈管理 CRUD | 二期补 |
| 报名状态确认操作 | 二期补 |
| 邀请奖励手动发放/取消 | 二期补 |
| 统计时间筛选/趋势图/导出 | 二期补 |
| 商户管理 | 一期不做多商户 |
| 分销管理 | 一期不做分销 |
| 直播管理 | 一期不做直播 |

---

## 9. 裂变范围

### 9.1 一期裂变规则

| 规则 | 说明 |
|------|------|
| 邀请层级 | **仅一级**，A 邀请 B，A 获得奖励；B 再邀请 C，A 不获得奖励 |
| 注册奖励 | B 通过 A 的邀请码注册成功 → A 获得 N 积分 |
| 首单奖励 | B 首次下单支付成功 → A 获得 M 积分 |
| 奖励类型 | **仅积分**，不做优惠券、不做现金、不做佣金 |
| 奖励发放时机 | 注册/首单事件触发后即时发放 |
| 防重复 | `uk_inviter_invitee_event` 唯一约束，同一邀请人对同一被邀请人的同一事件只奖励一次 |
| 邀请码格式 | 8位 MD5 哈希，用户注册时自动生成 |

### 9.2 一期不做的裂变功能

| 功能 | 延期原因 |
|------|---------|
| 二级及以上分佣 | 一期只做一级 |
| 佣金/现金奖励 | 一期只做积分 |
| 优惠券奖励 | 枚举预留，一期不实现发放逻辑 |
| 邀请海报图片 | 二期实现 Canvas 绘制 + 小程序码 |
| 邀请排行榜 | 二期评估 |
| 邀请任务体系 | 二期评估 |

---

## 10. 提审所需最低能力

| 能力 | 一期状态 | 说明 |
|------|---------|------|
| 用户协议勾选 | ✅ 已实现 | 登录/注册页有协议勾选 |
| 隐私政策链接 | ✅ 已实现 | 登录页有隐私政策链接 |
| 报名隐私协议 | ✅ 已实现 | 报名页有完整隐私告知+勾选 |
| 管理后台入口安全 | ✅ 已实现 | 安装时随机重命名 |
| HTTPS 配置 | ✅ 文档有 | 30-部署与发布说明 |
| 🔴 隐私协议内容定制 | ⚠️ 需补 | 当前使用 ShopXO 默认，需替换为母婴业务定制版 |
| 🔴 小程序类目匹配 | ⚠️ 需确认 | 母婴商城需选择正确类目 |
| 内容审核机制 | ❌ 二期 | UGC 量小时人工审核 |
| 敏感词过滤 | ❌ 二期 | 二期接入微信内容安全 API |
| 默认密码强制修改 | ⚠️ 文档有 | 53-提审准备清单提到，代码无强制机制 |

---

## 11. 技术约束

| 约束项 | 说明 |
|--------|------|
| 前端框架 | uni-app，一期仅适配微信小程序 |
| 后端框架 | ShopXO v6.8.0 (ThinkPHP 8) |
| 数据库 | MySQL 5.7+（推荐 8.0），utf8mb4 |
| 迁移入口 | `docs/muying-final-migration.sql` 为唯一执行入口 |
| 旧脚本 | `muying-migration.sql`、`muying-mvp-migration.sql` 等已废弃，不再执行 |
| Docker 镜像 | 当前 `mysql:8.0`，预部署环境为 5.7.44，需对齐 |
| 排序规则 | 统一使用 `utf8mb4_general_ci`，与 ShopXO 原生一致 |
| 一期范围过滤 | `phase-one-scope.js` 控制前端插件可见性 |
| 主题色 | `muying: #F5A0B1`，需在 `App.vue` 中注册 |

---

## 12. 当前数据库口径

| 项目 | 值 |
|------|-----|
| 迁移唯一入口 | `docs/muying-final-migration.sql` |
| MySQL 最低版本 | 5.7+ |
| MySQL 推荐版本 | 8.0 |
| 字符集 | utf8mb4 |
| 排序规则 | utf8mb4_general_ci |
| B 段兼容方式 | `information_schema` 检查字段是否存在，不依赖 `ADD COLUMN IF NOT EXISTS` |
| 自定义表数量 | 4 张（sxo_activity, sxo_activity_signup, sxo_invite_reward, sxo_muying_feedback） |
| 用户扩展字段 | 4 个（current_stage, due_date, baby_birthday, invite_code） |
| 唯一约束 | 2 个（uk_invite_code, uk_inviter_invitee_event） |
| 菜单权限 | C6 段（运营一级 + 4 个二级），C7 段（隐藏 5 个一期菜单） |

---

## 13. 风险与未决事项

### 13.1 P0 风险（不解决则核心功能不可用）

| # | 风险 | 影响 | 当前状态 |
|---|------|------|---------|
| 1 | App.vue 未注册 muying 主题色 | 全局主题色 undefined，TabBar/按钮/渐变全部异常 | 待修 |
| 2 | TabBar 选中态图标缺失 4 个 | 底部导航选中态无图标 | 待补 |
| 3 | goods.stage / goods.selling_point 数据来源未确认 | 商品详情页阶段标签和卖点标签可能为空 | 待确认 |
| 4 | 报名页无防重复提交 | 用户多次点击可能重复报名 | 待修 |
| 5 | 邀请码 Storage 清理不完整 | 旧邀请码可能被误用 | 待修 |

### 13.2 P1 风险（不解决则体验不完整）

| # | 风险 | 影响 | 当前状态 |
|---|------|------|---------|
| 6 | 取消报名前端无入口 | 后端已实现但用户无法操作 | 待补 |
| 7 | 用户反馈提交链路断开 | 首页展示有但无法提交 | 待补 |
| 8 | 反馈管理后台完全缺失 | 运营无法管理反馈数据 | 待补 |
| 9 | 报名状态确认操作缺失 | 待确认状态无法流转 | 待补 |
| 10 | 隐私协议内容未定制 | 提审可能被拒 | 待补 |

### 13.3 未决事项

| # | 事项 | 决策状态 | 建议 |
|---|------|---------|------|
| 1 | docker-compose.yml MySQL 镜像版本 | 未决策 | 切换为 `mysql:5.7.44` 与预部署对齐 |
| 2 | docker-compose.yml 排序规则 | 未决策 | 统一为 `utf8mb4_general_ci` |
| 3 | invite 与 my-invite 页面定位重叠 | 未决策 | 一期保持现状，二期合并或明确区分 |
| 4 | 付费活动报名支付流程 | 未决策 | 一期活动报名仅免费，付费活动走商城下单 |
| 5 | 报名页月龄 off-by-one | 已知 | 自动计算与手动选择索引基准不一致，需修 |
| 6 | Muyingtest.php 是否存在 | 已确认 | 不存在，无需清理 |

---

## 附录：建议优先开发顺序

基于"先跑通核心链路，再补体验"的原则，建议按以下顺序推进一期剩余工作：

### 第一批：修复全局性 BUG（1-2 天）

1. **App.vue 注册 muying 主题色** — 0.5h，影响全局
2. **补充 TabBar 选中态图标** — 1h，影响全局导航
3. **报名页防重复提交** — 0.5h，防止数据异常
4. **邀请码 Storage 清理** — 1h，防止邀请关系错乱

### 第二批：确认数据链路（1 天）

5. **确认 goods.stage / goods.selling_point 数据来源** — 2h，决定商品标签是否可用
6. **确认 docker-compose MySQL 镜像和排序规则** — 1h，环境对齐
7. **在 5.7 环境完整执行一次迁移** — 2h，验证数据库兼容性

### 第三批：补齐前后端闭环（2-3 天）

8. **取消报名前端入口** — 2h，后端已实现
9. **报名页月龄 off-by-one 修复** — 1h
10. **活动详情 onShow 刷新** — 1h
11. **用户反馈提交 API + 管理后台** — 6h，补齐闭环
12. **报名状态确认（Admin）** — 2h

### 第四批：提审准备（1-2 天）

13. **隐私协议内容定制** — 2h
14. **小程序类目确认** — 0.5h
15. **全流程回归测试** — 4h
16. **提审提交** — 0.5h

### 第五批：体验优化（提审后迭代）

17. 分类页母婴阶段筛选
18. 孕周计算展示
19. 统计服务时间筛选
20. 个人中心预产期/宝宝生日展示
