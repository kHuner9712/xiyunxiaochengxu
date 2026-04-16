-- ============================================================
-- 母婴商城扩展表迁移脚本
-- 创建时间: 2026-04-16
-- 说明: 新增活动表、活动报名表、邀请奖励表，用户表增加阶段字段
-- ============================================================

-- -----------------------------------------------------------
-- 1. 活动表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sxo_activity` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` char(200) NOT NULL DEFAULT '' COMMENT '活动标题',
  `cover` char(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `images` text COMMENT '相册图片JSON',
  `category` char(30) NOT NULL DEFAULT '' COMMENT '活动类型(classroom课堂/salon沙龙/lecture讲座/trial试用/holiday节日/checkin打卡)',
  `stage` char(30) NOT NULL DEFAULT '' COMMENT '适用阶段(prepare备孕/pregnancy孕期/postpartum产后/all通用)',
  `description` text COMMENT '活动简介',
  `content` longtext COMMENT '活动详情HTML',
  `address` char(255) NOT NULL DEFAULT '' COMMENT '活动地址',
  `start_time` int unsigned NOT NULL DEFAULT 0 COMMENT '开始时间',
  `end_time` int unsigned NOT NULL DEFAULT 0 COMMENT '结束时间',
  `signup_start_time` int unsigned NOT NULL DEFAULT 0 COMMENT '报名开始时间',
  `signup_end_time` int unsigned NOT NULL DEFAULT 0 COMMENT '报名截止时间',
  `max_count` int unsigned NOT NULL DEFAULT 0 COMMENT '最大报名人数(0不限)',
  `signup_count` int unsigned NOT NULL DEFAULT 0 COMMENT '已报名人数',
  `is_free` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否免费(0否/1是)',
  `price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '活动价格',
  `contact_name` char(60) NOT NULL DEFAULT '' COMMENT '联系人',
  `contact_phone` char(30) NOT NULL DEFAULT '' COMMENT '联系电话',
  `access_count` int unsigned NOT NULL DEFAULT 0 COMMENT '访问量',
  `sort_level` int unsigned NOT NULL DEFAULT 0 COMMENT '排序',
  `is_enable` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否启用(0否/1是)',
  `is_delete_time` int unsigned NOT NULL DEFAULT 0 COMMENT '是否删除',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `category` (`category`),
  KEY `stage` (`stage`),
  KEY `is_enable` (`is_enable`),
  KEY `is_delete_time` (`is_delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动表';

-- -----------------------------------------------------------
-- 2. 活动报名表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sxo_activity_signup` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` int unsigned NOT NULL DEFAULT 0 COMMENT '活动ID',
  `user_id` int unsigned NOT NULL DEFAULT 0 COMMENT '用户ID',
  `name` char(60) NOT NULL DEFAULT '' COMMENT '报名姓名',
  `phone` char(30) NOT NULL DEFAULT '' COMMENT '联系电话',
  `stage` char(30) NOT NULL DEFAULT '' COMMENT '当前阶段',
  `due_date` int unsigned NOT NULL DEFAULT 0 COMMENT '预产期(时间戳)',
  `baby_month_age` int unsigned NOT NULL DEFAULT 0 COMMENT '宝宝月龄(月)',
  `remark` char(255) NOT NULL DEFAULT '' COMMENT '备注',
  `status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '状态(0待确认/1已确认/2已取消)',
  `checkin_status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '签到状态(0未签到/1已签到)',
  `checkin_time` int unsigned NOT NULL DEFAULT 0 COMMENT '签到时间',
  `is_delete_time` int unsigned NOT NULL DEFAULT 0 COMMENT '是否删除',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `activity_id` (`activity_id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  KEY `checkin_status` (`checkin_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动报名表';

-- -----------------------------------------------------------
-- 3. 邀请奖励表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sxo_invite_reward` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `inviter_id` int unsigned NOT NULL DEFAULT 0 COMMENT '邀请人用户ID',
  `invitee_id` int unsigned NOT NULL DEFAULT 0 COMMENT '被邀请人用户ID',
  `reward_type` char(30) NOT NULL DEFAULT 'integral' COMMENT '奖励类型(integral积分/coupon优惠券)',
  `reward_value` int unsigned NOT NULL DEFAULT 0 COMMENT '奖励值(积分数/优惠券ID)',
  `trigger_event` char(30) NOT NULL DEFAULT 'register' COMMENT '触发事件(register注册/first_order首单)',
  `status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '状态(0待发放/1已发放/2已取消)',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `inviter_id` (`inviter_id`),
  KEY `invitee_id` (`invitee_id`),
  KEY `trigger_event` (`trigger_event`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请奖励表';

-- -----------------------------------------------------------
-- 4. 用户表增加母婴阶段字段
-- -----------------------------------------------------------
ALTER TABLE `sxo_user` ADD COLUMN `current_stage` char(30) NOT NULL DEFAULT '' COMMENT '当前阶段(prepare备孕/pregnancy孕期/postpartum产后)' AFTER `address`;
ALTER TABLE `sxo_user` ADD COLUMN `due_date` int unsigned NOT NULL DEFAULT 0 COMMENT '预产期(时间戳)' AFTER `current_stage`;
ALTER TABLE `sxo_user` ADD COLUMN `baby_birthday` int unsigned NOT NULL DEFAULT 0 COMMENT '宝宝生日(时间戳)' AFTER `due_date`;
