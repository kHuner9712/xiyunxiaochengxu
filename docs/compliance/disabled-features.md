# 一期禁用功能清单

> 本文档记录一期上线时被禁用的功能及其禁用方式，确保前后端双重拦截。

## 禁用方式说明

| 层级 | 禁用方式 | 文件位置 |
|------|---------|---------|
| 后端 API 拦截 | `Plugins::IsPluginBlocked()` 在 API 入口强制返回错误 | `app/api/controller/Plugins.php` |
| 前端路由过滤 | `phase-one-scope.js` 隐藏禁用插件的路由入口 | `common/js/config/phase-one-scope.js` |
| 前端导航过滤 | `filter_phase_one_navigation()` 过滤导航项 | `common/js/config/phase-one-scope.js` |
| 功能开关 | MyC 配置 `feature_xxx_enabled`，默认 0（关闭） | `sxo_config` 表 |

## 禁用插件清单

| 插件名 | 功能 | 禁用原因 | 功能开关键 | 后端拦截 | 前端过滤 |
|-------|------|---------|-----------|---------|---------|
| distribution | 分销/多级返佣 | 涉嫌传销风险 | feature_distribution_enabled | ✅ | ✅ |
| wallet | 钱包/余额/充值/提现 | 需支付牌照 | feature_wallet_enabled | ✅ | ✅ |
| coin | 虚拟币 | 需合规审批 | feature_coin_enabled | ✅ | ✅ |
| shop | 第三方商家入驻 | 需 ICP 经营许可证 | feature_shop_enabled | ✅ | ✅ |
| realstore | 门店/多门店 | 需 ICP 经营许可证 | feature_realstore_enabled | ✅ | ✅ |
| ask | 问答社区 | 需内容审核能力 | feature_ugc_enabled | ✅ | ✅ |
| blog | 博客/帖子 | 需内容审核能力 | feature_ugc_enabled | ✅ | ✅ |
| membershiplevelvip | 会员等级VIP | 需合规审批 | feature_membership_enabled | ✅ | ✅ |
| seckill | 秒杀 | 营销合规风险 | feature_seckill_enabled | ✅ | ✅ |
| video | 视频 | 需网络视听许可证 | feature_video_enabled | ✅ | ✅ |
| hospital | 医疗咨询/问诊 | 需医疗机构执业许可证 | feature_hospital_enabled | ✅ | ✅ |
| giftcard | 礼品卡 | 需预付卡备案 | feature_giftcard_enabled | ✅ | ✅ |
| givegift | 送礼 | 涉及资金流转 | feature_givegift_enabled | ✅ | ✅ |
| complaint | 投诉 | 需客服体系完备 | feature_complaint_enabled | ✅ | ✅ |
| invoice | 发票 | 需税务资质 | feature_invoice_enabled | ✅ | ✅ |
| certificate | 证书 | 非一期核心 | feature_certificate_enabled | ✅ | ✅ |
| scanpay | 扫码支付 | 需支付牌照 | feature_scanpay_enabled | ✅ | ✅ |
| weixinliveplayer | 微信直播 | 需网络文化经营许可证 | feature_live_enabled | ✅ | ✅ |
| intellectstools | 智能工具 | 非一期核心 | feature_intellectstools_enabled | ✅ | ✅ |

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

## 一期保留但动态控制的插件

| 插件名 | 功能 | 功能开关键 | 默认状态 |
|-------|------|-----------|---------|
| coupon | 优惠券 | feature_coupon_enabled | 由后台配置决定 |
| signin | 签到 | feature_signin_enabled | 由后台配置决定 |
| points | 积分 | feature_points_enabled | 由后台配置决定 |
| activity | 活动 | feature_activity_enabled | 一期启用 |
| invite | 邀请 | feature_invite_enabled | 一期启用 |

## 启用流程

1. 在后台「系统设置 → 配置管理」中找到对应功能开关
2. 将 `feature_xxx_enabled` 设置为 `1`
3. 后端拦截自动放行（`Plugins::IsPluginBlocked()` 读取 MyC 配置）
4. 前端 `init_feature_flags()` 读取后端返回的开关状态，动态调整禁用列表
5. 需确认合规资质后再启用

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-04-24 | 初始版本，定义一期禁用功能清单 |
