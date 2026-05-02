-- ============================================================
-- 禧孕一期功能开关迁移
-- 作用：在 sxo_config 表中插入 feature_* 开关配置项
-- 执行时机：数据库初始化后执行一次即可
-- 幂等性：使用 ON DUPLICATE KEY UPDATE，可重复执行
-- ============================================================

-- F1. 功能开关配置项
-- type='admin' 表示仅后台可见可配
-- value='0' 表示默认关闭，value='1' 表示默认开启
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', '多商户开关', '控制多商户/商家入驻/店铺中心功能是否开放', '请选择是否开启', 'admin', 'feature_shop_enabled', UNIX_TIMESTAMP()),
('0', '多门店开关', '控制多门店功能是否开放', '请选择是否开启', 'admin', 'feature_realstore_enabled', UNIX_TIMESTAMP()),
('0', '分销开关', '控制分销/多级分佣功能是否开放', '请选择是否开启', 'admin', 'feature_distribution_enabled', UNIX_TIMESTAMP()),
('0', '钱包开关', '控制钱包/余额功能是否开放', '请选择是否开启', 'admin', 'feature_wallet_enabled', UNIX_TIMESTAMP()),
('0', '积分商城开关', '控制积分商城/虚拟币功能是否开放', '请选择是否开启', 'admin', 'feature_coin_enabled', UNIX_TIMESTAMP()),
('0', '用户内容开关', '控制问答/博客/社区等用户生成内容功能是否开放', '请选择是否开启', 'admin', 'feature_ugc_enabled', UNIX_TIMESTAMP()),
('0', '会员付费开关', '控制会员高级付费模块是否开放', '请选择是否开启', 'admin', 'feature_membership_enabled', UNIX_TIMESTAMP()),
('0', '秒杀开关', '控制限时秒杀功能是否开放', '请选择是否开启', 'admin', 'feature_seckill_enabled', UNIX_TIMESTAMP()),
('0', '优惠券开关', '控制优惠券中心功能是否开放', '请选择是否开启', 'admin', 'feature_coupon_enabled', UNIX_TIMESTAMP()),
('0', '签到开关', '控制签到打卡功能是否开放', '请选择是否开启', 'admin', 'feature_signin_enabled', UNIX_TIMESTAMP()),
('0', '积分兑换开关', '控制积分兑换功能是否开放', '请选择是否开启', 'admin', 'feature_points_enabled', UNIX_TIMESTAMP()),
('0', '视频开关', '控制视频模块是否开放', '请选择是否开启', 'admin', 'feature_video_enabled', UNIX_TIMESTAMP()),
('0', '互联网医院开关', '控制互联网医院功能是否开放', '请选择是否开启', 'admin', 'feature_hospital_enabled', UNIX_TIMESTAMP()),
('0', '礼品卡开关', '控制礼品卡功能是否开放', '请选择是否开启', 'admin', 'feature_giftcard_enabled', UNIX_TIMESTAMP()),
('0', '送礼开关', '控制送礼功能是否开放', '请选择是否开启', 'admin', 'feature_givegift_enabled', UNIX_TIMESTAMP()),
('0', '投诉开关', '控制投诉功能是否开放', '请选择是否开启', 'admin', 'feature_complaint_enabled', UNIX_TIMESTAMP()),
('0', '发票开关', '控制发票功能是否开放', '请选择是否开启', 'admin', 'feature_invoice_enabled', UNIX_TIMESTAMP()),
('0', '实名认证开关', '控制实名认证功能是否开放', '请选择是否开启', 'admin', 'feature_certificate_enabled', UNIX_TIMESTAMP()),
('0', '扫码支付开关', '控制扫码支付功能是否开放', '请选择是否开启', 'admin', 'feature_scanpay_enabled', UNIX_TIMESTAMP()),
('0', '直播开关', '控制微信直播功能是否开放', '请选择是否开启', 'admin', 'feature_live_enabled', UNIX_TIMESTAMP()),
('0', '智能工具开关', '控制智能工具功能是否开放', '请选择是否开启', 'admin', 'feature_intellectstools_enabled', UNIX_TIMESTAMP()),
('1', '活动模块开关', '控制活动报名功能是否开放', '请选择是否开启', 'admin', 'feature_activity_enabled', UNIX_TIMESTAMP()),
('1', '邀请裂变开关', '控制邀请裂变功能是否开放', '请选择是否开启', 'admin', 'feature_invite_enabled', UNIX_TIMESTAMP()),
('1', '官方内容开关', '控制文章/资讯等官方内容功能是否开放', '请选择是否开启', 'admin', 'feature_content_enabled', UNIX_TIMESTAMP()),
('1', '用户反馈开关', '控制用户反馈/妈妈说功能是否开放', '请选择是否开启', 'admin', 'feature_feedback_enabled', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `upd_time`=UNIX_TIMESTAMP();

-- F2. 后台"功能开关"菜单（挂在"运营"一级菜单下）
-- 先查找运营菜单的 id，如果不存在则创建
-- 使用变量确保幂等
SET @op_pid = (SELECT `id` FROM `sxo_power` WHERE `control`='activity' AND `pid`=0 AND `action`='index' LIMIT 1);

-- 仅当运营菜单存在时插入功能开关子菜单
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`)
SELECT @op_pid, '功能开关', 'featureswitch', 'index', '', 99, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM DUAL
WHERE @op_pid IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM `sxo_power` WHERE `control`='featureswitch' AND `action`='index' AND `pid`=@op_pid);
SET @fsw_id = (SELECT `id` FROM `sxo_power` WHERE `control`='featureswitch' AND `action`='index' LIMIT 1);

-- 功能开关操作权限
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`)
SELECT @fsw_id, '功能开关保存', 'featureswitch', 'save', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM DUAL
WHERE @fsw_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM `sxo_power` WHERE `control`='featureswitch' AND `action`='save');

-- F3. 隐藏一期不开放的后台菜单（将 is_show 设为 0）
-- 仅对已存在的菜单执行，不存在的不会报错
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='shop' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='distribution' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='wallet' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='coin' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='ask' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='blog' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='membershiplevelvip' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='seckill' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='coupon' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='signin' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='weixinliveplayer' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='video' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='hospital' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='giftcard' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='givegift' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='complaint' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='invoice' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='certificate' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='scanpay' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='intellectstools' AND `pid`=0 AND `is_show`=1;
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `control`='points' AND `pid`=0 AND `is_show`=1;

-- 同时隐藏上述顶级菜单下的所有子菜单
UPDATE `sxo_power` SET `is_show`=0, `upd_time`=UNIX_TIMESTAMP() WHERE `pid` IN (SELECT `id` FROM (SELECT `id` FROM `sxo_power` WHERE `control` IN ('shop','distribution','wallet','coin','ask','blog','membershiplevelvip','seckill','coupon','signin','weixinliveplayer','video','hospital','giftcard','givegift','complaint','invoice','certificate','scanpay','intellectstools','points') AND `pid`=0) AS tmp) AND `is_show`=1;
