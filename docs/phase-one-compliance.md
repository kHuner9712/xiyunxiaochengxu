# 孕禧 V1.0 一期合规策略

## 一期允许功能（默认开启）

| 功能 | 功能开关 | 说明 |
|------|---------|------|
| 自营商品 | 无需开关 | ShopXO 核心能力 |
| 购物车/订单/售后 | 无需开关 | ShopXO 核心能力 |
| 活动报名 | feature_activity_enabled | 官方活动发布、报名、签到 |
| 一级邀请裂变 | feature_invite_enabled | 一级邀请，无多级返佣 |
| 官方内容 | feature_content_enabled | 文章/公告/首页装修 |
| 用户反馈 | feature_feedback_enabled | 妈妈说/反馈工单 |

## 一期受控功能（默认关闭，后台可按需开启）

| 功能 | 功能开关 | 约束条件 |
|------|---------|---------|
| 优惠券 | feature_coupon_enabled | 仅自营商品、非现金、不可提现、不可转让 |
| 签到打卡 | feature_signin_enabled | 非现金、不可提现、不可转让 |
| 积分兑换 | feature_points_enabled | 仅自营商品、不可提现、不可储值、不可转余额 |

## 一期禁止功能（资质门禁强制拦截）

| 功能 | 功能开关 | 所需资质 |
|------|---------|---------|
| 多商户/商家入驻 | feature_shop_enabled | ICP经营许可证 + EDI许可证 |
| 多门店 | feature_realstore_enabled | ICP经营许可证 + EDI许可证 |
| 分销/多级返佣 | feature_distribution_enabled | ICP经营许可证 |
| 钱包/余额/提现 | feature_wallet_enabled | 支付牌照 |
| 积分商城/虚拟币 | feature_coin_enabled | 支付牌照 |
| 问答/博客/UGC | feature_ugc_enabled | ICP经营许可证 |
| 会员VIP付费 | feature_membership_enabled | ICP经营许可证 |
| 限时秒杀 | feature_seckill_enabled | ICP经营许可证 |
| 礼品卡 | feature_giftcard_enabled | 支付牌照 |
| 送礼 | feature_givegift_enabled | 支付牌照 |
| 视频 | feature_video_enabled | 网络文化经营许可证 |
| 互联网医院 | feature_hospital_enabled | 医疗机构执业许可证 |
| 投诉 | feature_complaint_enabled | ICP经营许可证 |
| 发票 | feature_invoice_enabled | ICP经营许可证 |
| 实名认证 | feature_certificate_enabled | ICP经营许可证 |
| 扫码支付 | feature_scanpay_enabled | 支付牌照 |
| 微信直播 | feature_live_enabled | 网络文化经营许可证 |
| 智能工具 | feature_intellectstools_enabled | ICP经营许可证 |

## 合规拦截架构（5层防御）

### 第1层：前端路由守卫
- `App.vue` 中 `uni.addInterceptor` 拦截所有 navigateTo/redirectTo/reLaunch
- `phase_one_route_guard` 检查路由是否在禁用列表中
- 被拦截时 toast 提示"该功能暂未开放"

### 第2层：前端请求拦截
- `http.js` 中 `FEATURE_FLAG_ACTION_MAP` 检查 controller 级别功能开关
- `http.js` 中 `is_plugin_allowed(plugins)` 检查插件级别合规
- 后端返回 `-403` 时前端统一处理

### 第3层：后端 API 安全网
- `api/Common.php` 中 `$CONTROLLER_FEATURE_MAP` 集中式安全网
- `CommonInit()` 自动检查当前控制器是否需要功能开关
- `CheckFeatureEnabled()` 同时检查功能开关 + 资质门禁
- 返回统一错误码 `-403`

### 第4层：后端插件拦截
- `api/Plugins.php` 和 `index/Plugins.php` 调用 `MuyingComplianceService::IsPluginBlocked()`
- `admin/Plugins.php` 后台插件访问拦截
- `admin/Pluginsadmin.php` 安装/启用/上传拦截

### 第5层：后台功能开关门禁
- `Muyingcompliance::Toggle()` 调用 `TryToggleFeature()`
- `Featureswitch::Save()` 逐项调用 `TryToggleFeature()`
- 资质不满足时返回明确原因 + 记录合规日志

## 合规日志

所有合规拦截操作记录到 `sxo_muying_compliance_log` 表：
- `toggle_blocked`: 后台尝试开启被资质拦截的功能
- `toggle_allowed`: 后台成功开启功能（资质已满足）
- `api_blocked`: API 层拦截（包含 controller/action/userID/IP）

## 一期允许插件

brand, delivery, express

## 一期受控插件（需功能开关）

coupon, signin, points

## 一期禁止插件

distribution, wallet, coin, shop, realstore, ask, blog, membershiplevelvip, seckill, video, hospital, giftcard, givegift, complaint, invoice, certificate, scanpay, weixinliveplayer, intellectstools

## 永久禁止插件

excellentbuyreturntocash, exchangerate, goodscompare, orderfeed, ordergoodsform, orderresources, antifakecode, form, binding, label
