-- ============================================================
-- 母婴 MVP 补充迁移脚本
-- 创建时间: 2026-04-17
-- 说明: 补充活动表/报名表字段、新增运营菜单权限、隐藏一期不需要的功能
-- 依赖: 先执行 muying-migration.sql (建表)
-- ============================================================

-- -----------------------------------------------------------
-- 1. 补充活动表字段
-- -----------------------------------------------------------
ALTER TABLE `sxo_activity` ADD COLUMN `suitable_crowd` char(255) NOT NULL DEFAULT '' COMMENT '适合人群' AFTER `description`;

-- -----------------------------------------------------------
-- 2. 补充报名表字段（已在 muying-migration.sql 建表时包含，此处仅做兼容性补充）
-- 如果是从旧版升级（建表时没有这些字段），取消以下注释执行：
-- ALTER TABLE `sxo_activity_signup` ADD COLUMN `due_date` int unsigned NOT NULL DEFAULT 0 COMMENT '预产期(时间戳)' AFTER `stage`;
-- ALTER TABLE `sxo_activity_signup` ADD COLUMN `baby_month_age` int unsigned NOT NULL DEFAULT 0 COMMENT '宝宝月龄(月)' AFTER `due_date`;
-- ALTER TABLE `sxo_activity_signup` ADD COLUMN `checkin_status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '签到状态(0未签到/1已签到)' AFTER `status`;
-- ALTER TABLE `sxo_activity_signup` ADD COLUMN `checkin_time` int unsigned NOT NULL DEFAULT 0 COMMENT '签到时间' AFTER `checkin_status`;
-- -----------------------------------------------------------

-- -----------------------------------------------------------
-- 3. 新增"运营"一级菜单 (pid=0)
-- -----------------------------------------------------------
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(0, '运营', 'activity', 'index', '', 15, 1, 'icon-admin-operation', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 获取刚插入的一级菜单ID
SET @op_id = LAST_INSERT_ID();

-- 二级菜单：活动管理
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '活动管理', 'activity', 'index', '', 1, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @act_id = LAST_INSERT_ID();

-- 三级权限：活动管理操作
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@act_id, '活动详情', 'activity', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动添加/编辑', 'activity', 'saveinfo', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动保存', 'activity', 'save', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动删除', 'activity', 'delete', '', 4, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动状态更新', 'activity', 'statusupdate', '', 5, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 二级菜单：报名管理
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '报名管理', 'activitysignup', 'index', '', 2, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @signup_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@signup_id, '报名详情', 'activitysignup', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '签到核销', 'activitysignup', 'checkin', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '导出数据', 'activitysignup', 'export', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 二级菜单：邀请管理
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '邀请管理', 'invite', 'index', '', 3, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @invite_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@invite_id, '邀请详情', 'invite', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 二级菜单：数据报表
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '数据报表', 'muyingstat', 'index', '', 4, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- -----------------------------------------------------------
-- 4. 隐藏一期不需要的功能菜单
-- -----------------------------------------------------------
UPDATE `sxo_power` SET `is_show`=0 WHERE `name` IN ('多商户', '商家入驻', '分销管理', '直播管理', '积分商城') OR `control` IN ('shop', 'distribution', 'weixinliveplayer', 'coin');
