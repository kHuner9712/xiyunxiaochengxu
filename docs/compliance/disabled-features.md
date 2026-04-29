# 一期禁用功能清单

> 本文档记录一期上线时被禁用的功能及其禁用方式，确保前后端双重拦截。

## 四层拦截机制

| 层级 | 机制 | 文件位置 | 说明 |
|------|------|---------|------|
| 第一层 | 资质门禁 | `MuyingComplianceService.php` / `compliance-scope.js` | 即使功能开关误开，资质不满足也强制拦截 |
| 第二层 | 功能开关 | `sxo_config` 表 `feature_xxx_enabled` | 后台配置，默认关闭 |
| 第三层 | 前端白名单 | `compliance-scope.js` / `phase-one-scope.js` | 非白名单路由拦截 |
| 第四层 | 后端 API 拦截 | `api/Plugins.php` / `index/Plugins.php` | 调用 `MuyingComplianceService::IsPluginBlocked()` |

### 后端拦截逻辑

```php
// MuyingComplianceService::IsPluginAllowed($pluginsname)
// 1. 永久禁止列表 → 直接拒绝
// 2. 一期禁止列表 → 检查功能开关 AND 资质门禁
//    - 功能开关=0 → 拒绝，提示"该功能暂未开放"
//    - 功能开关=1 但资质不满足 → 拒绝，提示"当前资质暂不支持该功能"
//    - 功能开关=1 且资质满足 → 放行
// 3. 不在禁止列表 → 放行
```

### 前端拦截逻辑

```javascript
// compliance-scope.js: is_route_allowed(url)
// 1. 路径在 PHASE_ONE_ALLOWED_ROUTES 白名单中 → 放行
// 2. 不在白名单中 → 拦截，提示"该功能暂未开放"或"当前资质暂不支持该功能"
```

## 禁用插件清单

| 插件名 | 功能 | 禁用原因 | 功能开关键 | 所需资质 | 后端拦截 | 前端过滤 |
|-------|------|---------|-----------|---------|---------|---------|
| distribution | 分销/多级返佣 | 涉嫌传销风险 | feature_distribution_enabled | ICP商业 | ✅ | ✅ |
| wallet | 钱包/余额/充值/提现 | 需支付牌照 | feature_wallet_enabled | 支付牌照 | ✅ | ✅ |
| coin | 虚拟币 | 需合规审批 | feature_coin_enabled | 支付牌照 | ✅ | ✅ |
| shop | 第三方商家入驻 | 需 ICP+EDI | feature_shop_enabled | ICP商业+EDI | ✅ | ✅ |
| realstore | 门店/多门店 | 需 ICP+EDI | feature_realstore_enabled | ICP商业+EDI | ✅ | ✅ |
| ask | 问答社区 | 需内容审核能力 | feature_ugc_enabled | ICP商业 | ✅ | ✅ |
| blog | 博客/帖子 | 需内容审核能力 | feature_ugc_enabled | ICP商业 | ✅ | ✅ |
| membershiplevelvip | 会员等级VIP | 需合规审批 | feature_membership_enabled | ICP商业 | ✅ | ✅ |
| seckill | 秒杀 | 营销合规风险 | feature_seckill_enabled | ICP商业 | ✅ | ✅ |
| video | 视频 | 需网络视听许可证 | feature_video_enabled | 直播资质 | ✅ | ✅ |
| hospital | 医疗咨询/问诊 | 需医疗机构执业许可证 | feature_hospital_enabled | 医疗资质 | ✅ | ✅ |
| giftcard | 礼品卡 | 需预付卡备案 | feature_giftcard_enabled | 支付牌照 | ✅ | ✅ |
| givegift | 送礼 | 涉及资金流转 | feature_givegift_enabled | 支付牌照 | ✅ | ✅ |
| complaint | 投诉 | 需客服体系完备 | feature_complaint_enabled | ICP商业 | ✅ | ✅ |
| invoice | 发票 | 需税务资质 | feature_invoice_enabled | ICP商业 | ✅ | ✅ |
| certificate | 证书 | 非一期核心 | feature_certificate_enabled | ICP商业 | ✅ | ✅ |
| scanpay | 扫码支付 | 需支付牌照 | feature_scanpay_enabled | 支付牌照 | ✅ | ✅ |
| weixinliveplayer | 微信直播 | 需网络文化经营许可证 | feature_live_enabled | 直播资质 | ✅ | ✅ |
| intellectstools | 智能工具 | 非一期核心 | feature_intellectstools_enabled | ICP商业 | ✅ | ✅ |

## 永久禁用插件（不在功能开关范围内）

| 插件名 | 功能 | 禁用原因 |
|-------|------|---------|
| excellentbuyreturntocash | 优购返现 | 涉嫌传销 |
| exchangerate | 汇率 | 非业务需要 |
| goodscompare | 商品对比 | 非一期核心 |
| orderfeed | 订单动态 | 非一期核心 |
| ordergoodsform | 订单商品表单 | 非一期核心 |
| orderresources | 订单资源 | 非一期核心 |
| antifakecode | 防伪码 | 非一期核心 |
| form | 自定义表单 | 非一期核心 |
| binding | 绑定 | 非一期核心 |
| label | 标签 | 非一期核心 |

## 一期允许的插件

| 插件名 | 功能 | 功能开关键 | 默认状态 |
|-------|------|-----------|---------|
| brand | 品牌 | 无需开关 | 始终允许 |
| coupon | 优惠券 | feature_coupon_enabled | 一期启用 |
| delivery | 配送 | 无需开关 | 始终允许 |
| express | 快递查询 | 无需开关 | 始终允许 |
| points | 积分 | feature_points_enabled | 一期启用 |
| signin | 签到 | feature_signin_enabled | 一期启用 |
| activity | 活动 | feature_activity_enabled | 一期启用 |
| invite | 邀请 | feature_invite_enabled | 一期启用 |

## 启用流程

1. 在后台「系统设置 → 配置管理」中设置对应资质门禁为 1（已取得资质）
2. 设置对应功能开关 `feature_xxx_enabled = 1`
3. 后端拦截自动放行（`MuyingComplianceService` 读取 MyC 配置 + 资质门禁）
4. 前端 `init_feature_flags()` 读取后端返回的开关状态和资质状态，动态调整禁用列表
5. 需确认合规资质后再启用

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-04-24 | 初始版本，定义一期禁用功能清单 |
| 2026-04-25 | 新增资质门禁机制，从黑名单改为四层拦截机制 |
| 2026-04-30 | 补充 MUYING_PRIVACY_KEY 必填说明、composer.lock 要求、预检脚本增强说明 |
