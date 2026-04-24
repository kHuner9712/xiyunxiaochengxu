-- ============================================================
-- [MUYING-二开] 一期功能开关初始化迁移
-- 作用：插入所有 feature_xxx_enabled 配置项到 sxo_config 表
--       高风险功能默认关闭(0)，一期允许能力默认开启(1)
-- 幂等性：使用 ON DUPLICATE KEY UPDATE，可重复执行
-- 兼容：MySQL 5.7.44+
-- 执行时机：在 muying-final-migration.sql 之后执行
-- ============================================================

-- ============================================================
-- 一、高风险功能开关（默认关闭 = 0）
-- 未取得 ICP 经营许可证阶段，以下功能服务端强制拦截
-- ============================================================

INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', '第三方商家入驻开关', '控制第三方商家入驻功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_shop_enabled', UNIX_TIMESTAMP()),
('0', '门店/多门店开关', '控制门店/多门店功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_realstore_enabled', UNIX_TIMESTAMP()),
('0', '分销/多级返佣开关', '控制分销/多级返佣功能是否开放（涉嫌传销风险）', '请选择是否开启', 'admin', 'feature_distribution_enabled', UNIX_TIMESTAMP()),
('0', '钱包/余额/提现开关', '控制钱包/余额/充值/提现功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_wallet_enabled', UNIX_TIMESTAMP()),
('0', '虚拟币开关', '控制虚拟币功能是否开放（需合规审批）', '请选择是否开启', 'admin', 'feature_coin_enabled', UNIX_TIMESTAMP()),
('0', 'UGC社区开关', '控制问答/博客/用户发帖功能是否开放（需内容审核能力）', '请选择是否开启', 'admin', 'feature_ugc_enabled', UNIX_TIMESTAMP()),
('0', '会员等级VIP开关', '控制会员等级/付费VIP功能是否开放（需合规审批）', '请选择是否开启', 'admin', 'feature_membership_enabled', UNIX_TIMESTAMP()),
('0', '秒杀开关', '控制秒杀功能是否开放（营销合规风险）', '请选择是否开启', 'admin', 'feature_seckill_enabled', UNIX_TIMESTAMP()),
('0', '礼品卡开关', '控制礼品卡功能是否开放（需预付卡备案）', '请选择是否开启', 'admin', 'feature_giftcard_enabled', UNIX_TIMESTAMP()),
('0', '送礼开关', '控制送礼功能是否开放（涉及资金流转）', '请选择是否开启', 'admin', 'feature_givegift_enabled', UNIX_TIMESTAMP()),
('0', '视频开关', '控制视频功能是否开放（需网络视听许可证）', '请选择是否开启', 'admin', 'feature_video_enabled', UNIX_TIMESTAMP()),
('0', '医疗咨询/问诊开关', '控制医疗咨询/问诊功能是否开放（需医疗机构执业许可证）', '请选择是否开启', 'admin', 'feature_hospital_enabled', UNIX_TIMESTAMP()),
('0', '投诉开关', '控制投诉功能是否开放（需客服体系完备）', '请选择是否开启', 'admin', 'feature_complaint_enabled', UNIX_TIMESTAMP()),
('0', '发票开关', '控制发票功能是否开放（需税务资质）', '请选择是否开启', 'admin', 'feature_invoice_enabled', UNIX_TIMESTAMP()),
('0', '证书开关', '控制证书功能是否开放（非一期核心）', '请选择是否开启', 'admin', 'feature_certificate_enabled', UNIX_TIMESTAMP()),
('0', '扫码支付开关', '控制扫码支付功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_scanpay_enabled', UNIX_TIMESTAMP()),
('0', '微信直播开关', '控制微信直播功能是否开放（需网络文化经营许可证）', '请选择是否开启', 'admin', 'feature_live_enabled', UNIX_TIMESTAMP()),
('0', '智能工具开关', '控制智能工具功能是否开放（非一期核心）', '请选择是否开启', 'admin', 'feature_intellectstools_enabled', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 二、一期基础能力开关（默认开启 = 1）
-- 自营商城 + 官方活动报名 + 会员运营 + 一级邀请裂变
-- ============================================================

INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('1', '活动报名开关', '控制官方活动报名功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_activity_enabled', UNIX_TIMESTAMP()),
('1', '一级邀请裂变开关', '控制一级邀请裂变功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_invite_enabled', UNIX_TIMESTAMP()),
('1', '官方内容开关', '控制文章/公告/首页装修等官方内容功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_content_enabled', UNIX_TIMESTAMP()),
('1', '用户反馈开关', '控制用户反馈/妈妈说功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_feedback_enabled', UNIX_TIMESTAMP()),
('1', '优惠券一期开关', '控制优惠券领取/使用功能是否开放（一期基础）', '请选择是否开启', 'admin', 'feature_coupon_enabled', UNIX_TIMESTAMP()),
('1', '签到开关', '控制每日签到功能是否开放（一期基础）', '请选择是否开启', 'admin', 'feature_signin_enabled', UNIX_TIMESTAMP()),
('1', '积分一期开关', '控制积分获取/消费功能是否开放（一期基础）', '请选择是否开启', 'admin', 'feature_points_enabled', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 三、二期扩展能力开关（默认关闭 = 0）
-- ============================================================

INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', '优惠券二期开关', '控制优惠券高级功能是否开放（二期扩展）', '请选择是否开启', 'admin', 'feature_coupon_v2_enabled', UNIX_TIMESTAMP()),
('0', '积分体系二期开关', '控制积分兑换/积分商城功能是否开放（二期扩展）', '请选择是否开启', 'admin', 'feature_points_v2_enabled', UNIX_TIMESTAMP()),
('0', '会员等级二期开关', '控制会员等级/付费VIP功能是否开放（二期扩展）', '请选择是否开启', 'admin', 'feature_membership_v2_enabled', UNIX_TIMESTAMP()),
('0', '钱包余额二期开关', '控制钱包/余额/充值/提现功能是否开放（二期扩展）', '请选择是否开启', 'admin', 'feature_wallet_v2_enabled', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 验证查询（执行后应返回所有 feature_xxx_enabled 配置项）
-- ============================================================
-- SELECT only_tag, value, name FROM sxo_config WHERE only_tag LIKE 'feature_%_enabled' ORDER BY only_tag;

-- ============================================================
-- 回滚（如需移除所有功能开关配置）
-- ============================================================
-- DELETE FROM sxo_config WHERE only_tag LIKE 'feature_%_enabled';
