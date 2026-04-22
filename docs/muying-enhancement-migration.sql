-- ============================================================
-- 孕禧母婴业务 增强功能 SQL（唯一真相源）
-- ============================================================
--
-- 【依赖】
--   必须先执行 muying-final-migration.sql + muying-audit-log-migration.sql
--   + muying-feature-switch-migration.sql
--
-- 【功能范围】
--   D1. 商品中心增强：商品阶段标签/卖点标签后台管理
--   D2. 活动中心增强：活动分类管理 + 报名表单配置
--   D3. 会员标签和备注：用户标签体系 + 运营备注
--   D4. 邀请配置页：邀请规则后台可视化配置
--   D5. 数据中心和仪表盘：统计快照 + 仪表盘配置
--
-- 【执行顺序】
--   D1 → D2 → D3 → D4 → D5（严格按序）
--
-- 【风险提示】
--   - 执行前必须备份数据库
--   - D3 新建表，不可跳步
--   - D5 的配置项使用 ON DUPLICATE KEY UPDATE，可重复执行
--
-- 【回滚提示】
--   见每段末尾的回滚 SQL
-- ============================================================


-- ============================================================
-- D1. 商品中心增强
-- 说明：sxo_goods 的 stage/selling_point 字段已在 B6 段添加
--       本段新增：商品阶段标签配置项 + 后台菜单
-- 开关：feature_shop_enabled（已有）
-- 开关关闭时：商品阶段标签/卖点标签编辑入口隐藏，前台不展示阶段筛选
-- ============================================================

-- D1.1 商品阶段标签配置项（运营可自定义每个阶段的展示名称和排序）
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('备孕,孕期,产后', '商品阶段标签', '逗号分隔的阶段标签名称，对应 prepare/pregnancy/postpartum', '请填写商品阶段标签', 'common', 'muying_goods_stage_labels', UNIX_TIMESTAMP()),
('1', '商品卖点标签是否启用', '开启后商品详情页显示卖点标签', '请选择', 'common', 'muying_goods_selling_point_enabled', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `upd_time`=UNIX_TIMESTAMP();

-- D1.2 回滚
-- DELETE FROM sxo_config WHERE only_tag IN ('muying_goods_stage_labels', 'muying_goods_selling_point_enabled');


-- ============================================================
-- D2. 活动中心增强
-- 说明：sxo_activity 已有基础结构
--       本段新增：活动分类配置 + 报名表单字段配置
-- 开关：feature_activity_enabled（已有）
-- 开关关闭时：活动分类管理入口隐藏，报名表单配置入口隐藏
-- ============================================================

-- D2.1 活动分类配置项（运营可自定义活动类型，覆盖 MuyingActivityCategory 枚举默认值）
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('孕妈课堂,线下沙龙,育儿讲座,试用官招募,节日活动,签到打卡', '活动分类名称', '逗号分隔，对应 classroom/salon/lecture/trial/holiday/checkin', '请填写活动分类名称', 'common', 'muying_activity_category_labels', UNIX_TIMESTAMP()),
('name,phone,stage', '报名表单必填字段', '逗号分隔，可选: name/phone/stage/due_date/baby_birthday/baby_month_age/remark', '请填写报名表单必填字段', 'common', 'muying_activity_signup_required_fields', UNIX_TIMESTAMP()),
('0', '报名需隐私协议', '开启后报名时必须勾选隐私协议', '请选择', 'common', 'muying_activity_signup_privacy_required', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `upd_time`=UNIX_TIMESTAMP();

-- D2.2 活动表补字段：organizer/organizer_phone（活动详情页已使用但表结构缺失）
SET @dbname = DATABASE();
SET @tablename = 'sxo_activity';

SET @colname = 'organizer';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `organizer` char(60) NOT NULL DEFAULT '''' COMMENT ''主办方名称'' AFTER `contact_phone`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'organizer_phone';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `organizer_phone` char(30) NOT NULL DEFAULT '''' COMMENT ''主办方电话'' AFTER `organizer`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D2.3 活动表补字段：signup_status（活动报名状态，避免前端每次计算）
SET @colname = 'signup_status';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `signup_status` char(20) NOT NULL DEFAULT ''ongoing'' COMMENT ''报名状态(not_started/ongoing/ended/full)'' AFTER `max_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D2.4 回滚
-- ALTER TABLE sxo_activity DROP COLUMN organizer, DROP COLUMN organizer_phone, DROP COLUMN signup_status;
-- DELETE FROM sxo_config WHERE only_tag IN ('muying_activity_category_labels', 'muying_activity_signup_required_fields', 'muying_activity_signup_privacy_required');


-- ============================================================
-- D3. 会员标签和备注
-- 新建表：sxo_muying_user_tag（用户标签）、sxo_muying_user_tag_rel（用户-标签关联）
-- 扩展字段：sxo_user 补 admin_remark（运营备注）
-- 开关：feature_membership_enabled（已有，复用会员开关）
-- 开关关闭时：标签管理入口隐藏，用户详情页不显示标签和备注
-- ============================================================

-- D3.1 用户标签表
CREATE TABLE IF NOT EXISTS `sxo_muying_user_tag` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` char(30) NOT NULL DEFAULT '' COMMENT '标签名称',
  `color` char(10) NOT NULL DEFAULT '#F5A0B1' COMMENT '标签颜色(HEX)',
  `sort_level` int unsigned NOT NULL DEFAULT 0 COMMENT '排序',
  `is_enable` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否启用(0否/1是)',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户标签';

-- D3.2 用户-标签关联表
CREATE TABLE IF NOT EXISTS `sxo_muying_user_tag_rel` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL DEFAULT 0 COMMENT '用户ID',
  `tag_id` int unsigned NOT NULL DEFAULT 0 COMMENT '标签ID',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_tag` (`user_id`, `tag_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户标签关联';

-- D3.3 sxo_user 补运营备注字段
SET @tablename = 'sxo_user';
SET @colname = 'admin_remark';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_user` ADD COLUMN `admin_remark` varchar(500) NOT NULL DEFAULT '''' COMMENT ''运营备注'' AFTER `invite_code`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D3.4 预置标签
INSERT INTO `sxo_muying_user_tag` (`name`, `color`, `sort_level`, `add_time`, `upd_time`) VALUES
('高价值', '#F5A0B1', 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('活跃用户', '#4CAF50', 2, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('沉默用户', '#999999', 3, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('孕期妈妈', '#FF9800', 4, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('产后妈妈', '#9C27B0', 5, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('备孕妈妈', '#2196F3', 6, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `upd_time`=UNIX_TIMESTAMP();

-- D3.5 回滚
-- DROP TABLE IF EXISTS sxo_muying_user_tag, sxo_muying_user_tag_rel;
-- ALTER TABLE sxo_user DROP COLUMN admin_remark;


-- ============================================================
-- D4. 邀请配置页
-- 说明：muying_invite_register_reward / muying_invite_first_order_reward 已在 C5 段插入
--       本段新增：邀请规则扩展配置 + 邀请开关独立控制
-- 开关：feature_invite_enabled（已有）
-- 开关关闭时：邀请配置页入口隐藏，所有邀请相关功能不可用
-- ============================================================

-- D4.1 邀请规则扩展配置
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('1', '邀请注册奖励是否自动发放', '开启后注册奖励立即发放，关闭后需手动审核', '请选择', 'common', 'muying_invite_register_auto_grant', UNIX_TIMESTAMP()),
('0', '邀请首单奖励是否自动发放', '开启后首单奖励立即发放，关闭后需手动审核', '请选择', 'common', 'muying_invite_first_order_auto_grant', UNIX_TIMESTAMP()),
('0', '邀请奖励每日上限', '0表示不限制，正整数表示每日最多发放奖励次数', '请填写邀请奖励每日上限', 'common', 'muying_invite_daily_limit', UNIX_TIMESTAMP()),
('邀请好友得积分，好物一起分享！', '邀请页宣传语', '邀请页顶部展示的宣传文案', '请填写邀请页宣传语', 'common', 'muying_invite_slogan', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `upd_time`=UNIX_TIMESTAMP();

-- D4.2 回滚
-- DELETE FROM sxo_config WHERE only_tag IN ('muying_invite_register_auto_grant', 'muying_invite_first_order_auto_grant', 'muying_invite_daily_limit', 'muying_invite_slogan');


-- ============================================================
-- D5. 数据中心和仪表盘
-- 新建表：sxo_muying_stat_snapshot（统计快照，用于趋势图）
-- 配置项：仪表盘展示指标配置
-- 开关：feature_activity_enabled（数据中心依赖活动数据）
-- 开关关闭时：数据报表入口隐藏，仪表盘不展示活动/邀请相关指标
-- ============================================================

-- D5.1 统计快照表（每日定时任务写入，仪表盘读取）
CREATE TABLE IF NOT EXISTS `sxo_muying_stat_snapshot` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL COMMENT '统计日期',
  `metric_key` char(60) NOT NULL DEFAULT '' COMMENT '指标键(registration_conversion/activity_signup_conversion/invite_referral/repurchase/stage_completion/dau)',
  `metric_value` decimal(10,4) NOT NULL DEFAULT 0.0000 COMMENT '指标值',
  `metric_detail` text COMMENT '指标详情JSON(如分阶段明细)',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_metric` (`stat_date`, `metric_key`),
  KEY `idx_date` (`stat_date`),
  KEY `idx_metric` (`metric_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='统计快照';

-- D5.2 仪表盘配置项
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('registration_conversion,activity_signup_conversion,invite_referral,repurchase,stage_completion', '仪表盘展示指标', '逗号分隔，可选: registration_conversion/activity_signup_conversion/invite_referral/repurchase/stage_completion/dau', '请填写仪表盘展示指标', 'common', 'muying_dashboard_metrics', UNIX_TIMESTAMP()),
('7', '仪表盘趋势天数', '仪表盘趋势图展示的天数', '请填写仪表盘趋势天数', 'common', 'muying_dashboard_trend_days', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `upd_time`=UNIX_TIMESTAMP();

-- D5.3 后台菜单：会员标签管理 + 邀请配置 + 仪表盘
-- 找到"运营"菜单的ID（之前C6段创建的）
SET @op_power_id = (SELECT `id` FROM `sxo_power` WHERE `name`='运营' AND `pid`=0 LIMIT 1);

-- 会员标签管理（放在运营菜单下）
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_power_id, '会员标签', 'usertag', 'index', '', 6, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @usertag_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@usertag_id, '标签详情', 'usertag', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@usertag_id, '标签保存', 'usertag', 'save', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@usertag_id, '标签删除', 'usertag', 'delete', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@usertag_id, '标签启停', 'usertag', 'statusupdate', '', 4, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@usertag_id, '用户打标签', 'usertag', 'usertagset', '', 5, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@usertag_id, '用户备注', 'usertag', 'adminremark', '', 6, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 邀请配置（放在运营菜单下）
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_power_id, '邀请配置', 'inviteconfig', 'index', '', 7, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @inviteconfig_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@inviteconfig_id, '配置保存', 'inviteconfig', 'save', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 仪表盘（放在运营菜单下，排在最前面）
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_power_id, '数据仪表盘', 'dashboard', 'index', '', 0, 1, 'icon-admin-home', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @dashboard_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@dashboard_id, '概览数据', 'dashboard', 'overview', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@dashboard_id, '趋势数据', 'dashboard', 'trend', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@dashboard_id, '生成快照', 'dashboard', 'generatesnapshot', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- D5.4 回滚
-- DROP TABLE IF EXISTS sxo_muying_stat_snapshot;
-- DELETE FROM sxo_config WHERE only_tag IN ('muying_dashboard_metrics', 'muying_dashboard_trend_days');
-- DELETE FROM sxo_power WHERE control IN ('usertag', 'inviteconfig', 'dashboard');
