-- ============================================================
-- 禧孕母婴业务 最终上线 SQL（唯一真相源）
-- ============================================================
--
-- 【适用场景】
--   1. 全新环境：从零部署，执行全部 A+B+C 段
--   2. 已有 ShopXO 环境：跳过 A 段已存在的表，执行 B+C 段
--
-- 【执行顺序】
--   A 段（基础建表） → B 段（增量补丁） → C 段（索引/约束/数据修复）
--   严格按段内顺序执行，不可跳步
--
-- 【风险提示】
--   - 执行前必须备份数据库
--   - C 段部分 SQL 不可重复执行（唯一索引只能加一次）
--   - C4 枚举修复会修改已有数据
--   - 不要执行 config/shopxo.sql（含 DROP TABLE，会清空所有数据）
--
-- 【MySQL 版本要求】
--   标准 MySQL 5.7.44（宝塔面板默认）
--   B 段增量补丁使用 information_schema 检查字段是否存在，兼容 5.6+
--   不依赖 ADD COLUMN IF NOT EXISTS（该语法仅 MySQL 8.0+ 支持）
--   不依赖窗口函数、CTE、JSON_TABLE 等 MySQL 8.0+ 专属语法
--
-- 【回滚提示】
--   见每段末尾的回滚 SQL，或从备份恢复：
--   mysql -u root -p shopxo < backup_XXXXXXXXXX.sql
--
-- 【表前缀】
--   本文件使用 sxo_ 前缀，与 ShopXO 安装默认一致
--   如果实际前缀不同，需全局替换
--
-- 【废弃声明】
--   以下旧文件已废弃，不要直接执行：
--   - docs/muying-migration.sql
--   - docs/muying-mvp-migration.sql
--   - docs/muying-invite-code-migration.sql
--   - docs/muying-invite-idempotent-migration.sql
--   - docs/muying-enum-normalize-migration.sql
--   - shopxo-backend/sql/muying_feedback.sql
-- ============================================================


-- ============================================================
-- A 段：基础建表
-- 适用：全新环境，或确认表不存在的环境
-- 可重复执行：是（CREATE TABLE IF NOT EXISTS）
-- 破坏已有数据：否
-- 执行前检查：确认数据库前缀为 sxo_
-- 执行后检查：SHOW TABLES LIKE 'sxo_activity%'; SHOW TABLES LIKE 'sxo_invite%'; SHOW TABLES LIKE 'sxo_muying%';
-- ============================================================

-- A1. 活动表
CREATE TABLE IF NOT EXISTS `sxo_activity` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` char(200) NOT NULL DEFAULT '' COMMENT '活动标题',
  `cover` char(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `images` text COMMENT '相册图片JSON',
  `category` char(30) NOT NULL DEFAULT '' COMMENT '活动类型(classroom/salon/lecture/trial/holiday/checkin)',
  `activity_type` char(30) NOT NULL DEFAULT 'offline' COMMENT '活动形式(offline线下/online线上)',
  `activity_status` char(30) NOT NULL DEFAULT 'draft' COMMENT '活动状态(draft草稿/published已发布/signing报名中/full已满/ended已结束/cancelled已取消)',
  `stage` char(30) NOT NULL DEFAULT '' COMMENT '适用阶段(prepare/pregnancy/postpartum/all)',
  `description` text COMMENT '活动简介',
  `content` longtext COMMENT '活动详情HTML',
  `suitable_crowd` char(255) NOT NULL DEFAULT '' COMMENT '适合人群',
  `address` char(255) NOT NULL DEFAULT '' COMMENT '活动地址',
  `start_time` int unsigned NOT NULL DEFAULT 0 COMMENT '开始时间',
  `end_time` int unsigned NOT NULL DEFAULT 0 COMMENT '结束时间',
  `signup_start_time` int unsigned NOT NULL DEFAULT 0 COMMENT '报名开始时间',
  `signup_end_time` int unsigned NOT NULL DEFAULT 0 COMMENT '报名截止时间',
  `max_count` int unsigned NOT NULL DEFAULT 0 COMMENT '最大报名人数(0不限)',
  `signup_count` int unsigned NOT NULL DEFAULT 0 COMMENT '已报名人数',
  `waitlist_count` int unsigned NOT NULL DEFAULT 0 COMMENT '候补名额(0不开放)',
  `waitlist_signup_count` int unsigned NOT NULL DEFAULT 0 COMMENT '已候补人数',
  `allow_waitlist` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否允许候补(0否/1是)',
  `signup_code_enabled` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否启用签到码(0否/1是)',
  `require_location_checkin` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否需要定位签到(0否/1是)',
  `latitude` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT '签到纬度',
  `longitude` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT '签到经度',
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
  KEY `idx_category` (`category`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_activity_status` (`activity_status`),
  KEY `idx_stage` (`stage`),
  KEY `idx_enable` (`is_enable`, `is_delete_time`),
  KEY `idx_time` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='活动表';

-- A2. 活动报名表（含隐私与候补完整字段）
CREATE TABLE IF NOT EXISTS `sxo_activity_signup` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` int unsigned NOT NULL DEFAULT 0 COMMENT '活动ID',
  `user_id` int unsigned NOT NULL DEFAULT 0 COMMENT '用户ID',
  `name` char(60) NOT NULL DEFAULT '' COMMENT '报名姓名(加密)',
  `phone` char(30) NOT NULL DEFAULT '' COMMENT '联系电话(加密)',
  `phone_hash` char(64) NOT NULL DEFAULT '' COMMENT '手机号哈希(用于重复校验)',
  `privacy_version` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '隐私加密版本(0明文/1AES加密)',
  `stage` char(30) NOT NULL DEFAULT '' COMMENT '当前阶段',
  `due_date` int unsigned NOT NULL DEFAULT 0 COMMENT '预产期(时间戳)',
  `baby_month_age` int unsigned NOT NULL DEFAULT 0 COMMENT '宝宝月龄(月)',
  `baby_birthday` int unsigned NOT NULL DEFAULT 0 COMMENT '宝宝生日(时间戳)',
  `remark` char(255) NOT NULL DEFAULT '' COMMENT '备注',
  `privacy_agreed_time` int unsigned NOT NULL DEFAULT 0 COMMENT '隐私同意时间',
  `status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '状态(0待确认/1已确认/2已取消)',
  `is_waitlist` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否候补(0正式/1候补)',
  `waitlist_to_normal_time` int unsigned NOT NULL DEFAULT 0 COMMENT '候补转正时间',
  `signup_code` char(8) NOT NULL DEFAULT '' COMMENT '签到码',
  `checkin_status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '签到状态(0未签到/1已签到)',
  `checkin_time` int unsigned NOT NULL DEFAULT 0 COMMENT '签到时间',
  `is_delete_time` int unsigned NOT NULL DEFAULT 0 COMMENT '是否删除',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_activity` (`activity_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_phone_hash` (`phone_hash`),
  KEY `idx_signup_code` (`signup_code`),
  KEY `idx_status` (`status`),
  KEY `idx_checkin` (`checkin_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='活动报名表';

-- A3. 邀请奖励表
CREATE TABLE IF NOT EXISTS `sxo_invite_reward` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `inviter_id` int unsigned NOT NULL DEFAULT 0 COMMENT '邀请人用户ID',
  `invitee_id` int unsigned NOT NULL DEFAULT 0 COMMENT '被邀请人用户ID',
  `reward_type` char(30) NOT NULL DEFAULT 'integral' COMMENT '奖励类型(integral/coupon)',
  `reward_value` int unsigned NOT NULL DEFAULT 0 COMMENT '奖励值',
  `trigger_event` char(30) NOT NULL DEFAULT 'register' COMMENT '触发事件(register/first_order)',
  `status` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '状态(0待发放/1已发放/2已取消)',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_inviter` (`inviter_id`),
  KEY `idx_invitee` (`invitee_id`),
  KEY `idx_trigger_event` (`trigger_event`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='邀请奖励表';

-- A4. 用户反馈表
CREATE TABLE IF NOT EXISTS `sxo_muying_feedback` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL DEFAULT 0 COMMENT '用户ID',
  `nickname` varchar(60) NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar` varchar(255) NOT NULL DEFAULT '' COMMENT '头像',
  `content` text NOT NULL COMMENT '反馈内容',
  `stage` varchar(30) NOT NULL DEFAULT '' COMMENT '当前阶段',
  `contact` varchar(60) NOT NULL DEFAULT '' COMMENT '联系方式(加密)',
  `contact_hash` char(64) NOT NULL DEFAULT '' COMMENT '联系方式哈希(用于去重)',
  `review_status` char(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态(pending待审核/approved已通过/rejected已驳回)',
  `review_remark` varchar(255) NOT NULL DEFAULT '' COMMENT '审核备注',
  `review_admin_id` int unsigned NOT NULL DEFAULT 0 COMMENT '审核管理员ID',
  `review_time` int unsigned NOT NULL DEFAULT 0 COMMENT '审核时间',
  `sort_level` int NOT NULL DEFAULT 0 COMMENT '排序',
  `is_enable` tinyint NOT NULL DEFAULT 1 COMMENT '是否启用',
  `is_delete_time` int unsigned NOT NULL DEFAULT 0 COMMENT '是否删除',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_enable` (`is_enable`, `is_delete_time`),
  KEY `idx_sort` (`sort_level`),
  KEY `idx_review_status` (`review_status`),
  KEY `idx_contact_hash` (`contact_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='母婴用户反馈';

-- A段回滚：
-- DROP TABLE IF EXISTS sxo_activity, sxo_activity_signup, sxo_invite_reward, sxo_muying_feedback;


-- ============================================================
-- B 段：增量补丁（在已有表上补字段）
-- 适用：已有 ShopXO 原生表，需补母婴扩展字段
-- 可重复执行：是（每条 ALTER 前检查字段是否已存在）
-- 破坏已有数据：否
-- MySQL 兼容：5.6+ / 5.7+ / 8.0+（不使用 IF NOT EXISTS 语法）
-- 执行前检查：SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sxo_user' AND COLUMN_NAME IN ('current_stage','due_date','baby_birthday','invite_code');
-- 执行后检查：DESCRIBE sxo_user; SHOW COLUMNS FROM sxo_goods_favor LIKE 'type'; SHOW COLUMNS FROM sxo_activity_signup LIKE 'privacy_agreed_time';
-- ============================================================

-- B1. sxo_user 扩展字段
SET @dbname = DATABASE();
SET @tablename = 'sxo_user';

SET @colname = 'current_stage';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_user` ADD COLUMN `current_stage` char(30) NOT NULL DEFAULT '''' COMMENT ''当前阶段(prepare/pregnancy/postpartum)'' AFTER `address`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'due_date';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_user` ADD COLUMN `due_date` int unsigned NOT NULL DEFAULT 0 COMMENT ''预产期(时间戳)'' AFTER `current_stage`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'baby_birthday';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_user` ADD COLUMN `baby_birthday` int unsigned NOT NULL DEFAULT 0 COMMENT ''宝宝生日(时间戳)'' AFTER `due_date`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'invite_code';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_user` ADD COLUMN `invite_code` char(8) NOT NULL DEFAULT '''' COMMENT ''邀请码'' AFTER `baby_birthday`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B2. sxo_activity_signup 补 privacy_agreed_time 字段（P0缺失，报名功能依赖）
SET @tablename = 'sxo_activity_signup';
SET @colname = 'privacy_agreed_time';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `privacy_agreed_time` int unsigned NOT NULL DEFAULT 0 COMMENT ''隐私同意时间'' AFTER `remark`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B3. sxo_goods_favor 补 type 字段（P0缺失，活动收藏功能依赖）
SET @tablename = 'sxo_goods_favor';
SET @colname = 'type';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods_favor` ADD COLUMN `type` char(30) NOT NULL DEFAULT ''goods'' COMMENT ''收藏类型(goods商品/activity活动)'' AFTER `user_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B4. sxo_activity 补 suitable_crowd 字段
SET @tablename = 'sxo_activity';
SET @colname = 'suitable_crowd';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `suitable_crowd` char(255) NOT NULL DEFAULT '''' COMMENT ''适合人群'' AFTER `description`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B5. sxo_activity_signup 补 baby_birthday 字段（报名快照，保留用户报名时填写的宝宝生日）
SET @tablename = 'sxo_activity_signup';
SET @colname = 'baby_birthday';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `baby_birthday` int unsigned NOT NULL DEFAULT 0 COMMENT ''宝宝生日(时间戳)'' AFTER `baby_month_age`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B5b. sxo_activity_signup 补 phone_hash 字段（用于手机号重复报名校验，不存储明文）
SET @colname = 'phone_hash';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `phone_hash` char(64) NOT NULL DEFAULT '''' COMMENT ''手机号哈希(用于重复校验)'' AFTER `phone`, ADD INDEX `idx_phone_hash` (`phone_hash`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B5c. sxo_activity_signup 补 is_waitlist / signup_code 字段
SET @colname = 'is_waitlist';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `is_waitlist` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否候补(0正式/1候补)'' AFTER `status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'signup_code';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `signup_code` char(8) NOT NULL DEFAULT '''' COMMENT ''签到码'' AFTER `is_waitlist`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B6. sxo_goods 补 stage / selling_point / approval_number 字段（母婴阶段标签与卖点标签数据来源）
SET @tablename = 'sxo_goods';

SET @colname = 'stage';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `stage` char(120) NOT NULL DEFAULT '''' COMMENT ''适用阶段(逗号分隔:pregnancy,postpartum等)'' AFTER `title`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'selling_point';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `selling_point` varchar(500) NOT NULL DEFAULT '''' COMMENT ''卖点标签(逗号分隔)'' AFTER `stage`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'approval_number';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `approval_number` char(60) NOT NULL DEFAULT '''' COMMENT ''批准文号(国食注字/妆字号等)'' AFTER `selling_point`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'min_baby_month_age';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `min_baby_month_age` int unsigned NOT NULL DEFAULT 0 COMMENT ''最小宝宝月龄(0不限)'' AFTER `approval_number`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'max_baby_month_age';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `max_baby_month_age` int unsigned NOT NULL DEFAULT 0 COMMENT ''最大宝宝月龄(0不限)'' AFTER `min_baby_month_age`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'focus_areas';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `focus_areas` varchar(255) NOT NULL DEFAULT '''' COMMENT ''关注领域(逗号分隔:安全/舒适/待产包/哺乳/早教/清洁等)'' AFTER `max_baby_month_age`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'risk_category';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `risk_category` char(20) NOT NULL DEFAULT ''low'' COMMENT ''风险类目(low/medium/high)'' AFTER `focus_areas`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'qualification_status';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `qualification_status` char(20) NOT NULL DEFAULT ''pending'' COMMENT ''资质状态(pending/approved/rejected)'' AFTER `risk_category`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'qualification_remark';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `qualification_remark` varchar(255) NOT NULL DEFAULT '''' COMMENT ''资质备注'' AFTER `qualification_status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'is_muying_recommend';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `is_muying_recommend` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否母婴推荐(0否/1是)'' AFTER `qualification_remark`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'muying_sort_level';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `muying_sort_level` int NOT NULL DEFAULT 0 COMMENT ''母婴排序权重(越大越靠前)'' AFTER `is_muying_recommend`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B段回滚：
-- ALTER TABLE sxo_user DROP COLUMN invite_code, DROP COLUMN baby_birthday, DROP COLUMN due_date, DROP COLUMN current_stage;
-- ALTER TABLE sxo_activity_signup DROP COLUMN privacy_agreed_time, DROP COLUMN baby_birthday, DROP COLUMN phone_hash, DROP COLUMN is_waitlist, DROP COLUMN signup_code, DROP COLUMN privacy_version, DROP COLUMN waitlist_to_normal_time;
-- ALTER TABLE sxo_goods_favor DROP COLUMN type;
-- ALTER TABLE sxo_activity DROP COLUMN suitable_crowd, DROP COLUMN activity_type, DROP COLUMN activity_status, DROP COLUMN waitlist_count, DROP COLUMN waitlist_signup_count, DROP COLUMN allow_waitlist, DROP COLUMN signup_code_enabled, DROP COLUMN require_location_checkin, DROP COLUMN latitude, DROP COLUMN longitude;
-- ALTER TABLE sxo_goods DROP COLUMN stage, DROP COLUMN selling_point, DROP COLUMN approval_number, DROP COLUMN min_baby_month_age, DROP COLUMN max_baby_month_age, DROP COLUMN focus_areas, DROP COLUMN risk_category, DROP COLUMN qualification_status, DROP COLUMN qualification_remark, DROP COLUMN is_muying_recommend, DROP COLUMN muying_sort_level;
-- ALTER TABLE sxo_muying_feedback DROP COLUMN contact, DROP COLUMN contact_hash;

-- B7. sxo_muying_feedback 补 contact 字段
SET @tablename = 'sxo_muying_feedback';
SET @colname = 'contact';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_muying_feedback` ADD COLUMN `contact` varchar(60) NOT NULL DEFAULT \'\' COMMENT \'联系方式(加密)\' AFTER `stage`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B7b. sxo_muying_feedback 补 contact_hash 字段
SET @colname = 'contact_hash';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_muying_feedback` ADD COLUMN `contact_hash` char(64) NOT NULL DEFAULT '''' COMMENT ''联系方式哈希(用于去重)'' AFTER `contact`, ADD INDEX `idx_contact_hash` (`contact_hash`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B8. sxo_activity 补 activity_type / activity_status 字段（已有环境升级用）
SET @tablename = 'sxo_activity';

SET @colname = 'activity_type';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `activity_type` char(30) NOT NULL DEFAULT ''offline'' COMMENT ''活动形式(offline线下/online线上)'' AFTER `category`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'activity_status';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `activity_status` char(30) NOT NULL DEFAULT ''draft'' COMMENT ''活动状态(draft/published/signing/full/ended/cancelled)'' AFTER `activity_type`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'waitlist_count';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `waitlist_count` int unsigned NOT NULL DEFAULT 0 COMMENT ''候补名额(0不开放)'' AFTER `signup_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'waitlist_signup_count';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `waitlist_signup_count` int unsigned NOT NULL DEFAULT 0 COMMENT ''已候补人数'' AFTER `waitlist_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'allow_waitlist';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `allow_waitlist` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否允许候补(0否/1是)'' AFTER `waitlist_signup_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'signup_code_enabled';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `signup_code_enabled` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否启用签到码(0否/1是)'' AFTER `allow_waitlist`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'require_location_checkin';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `require_location_checkin` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否需要定位签到(0否/1是)'' AFTER `signup_code_enabled`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'latitude';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `latitude` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT ''签到纬度'' AFTER `require_location_checkin`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'longitude';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `longitude` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT ''签到经度'' AFTER `latitude`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- B9. sxo_activity_signup 补 privacy_version / waitlist_to_normal_time 字段
SET @tablename = 'sxo_activity_signup';

SET @colname = 'privacy_version';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `privacy_version` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''隐私加密版本(0明文/1AES加密)'' AFTER `phone_hash`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @colname = 'waitlist_to_normal_time';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `waitlist_to_normal_time` int unsigned NOT NULL DEFAULT 0 COMMENT ''候补转正时间'' AFTER `is_waitlist`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ============================================================
-- C 段：索引/唯一约束/数据修复
-- 适用：A段和B段都执行完后
-- 可重复执行：否（唯一索引只能加一次）
-- 破坏已有数据：C3去重会删除重复记录，C4会修改枚举值
-- 执行前检查：见每步说明
-- 执行后检查：SHOW INDEX FROM sxo_user WHERE Key_name='uk_invite_code'; SHOW INDEX FROM sxo_invite_reward WHERE Key_name='uk_inviter_invitee_event';
-- ============================================================

-- C1. 为已有用户补邀请码
-- 执行前检查：SELECT COUNT(*) FROM sxo_user WHERE invite_code='' OR invite_code IS NULL;
-- 如果结果=0则跳过
DELIMITER //
DROP PROCEDURE IF EXISTS `muying_fill_invite_code`//
CREATE PROCEDURE `muying_fill_invite_code`()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id INT;
    DECLARE v_code CHAR(8);
    DECLARE v_exists INT;
    DECLARE v_attempts INT;
    DECLARE cur CURSOR FOR SELECT `id` FROM `sxo_user` WHERE `invite_code` = '' OR `invite_code` IS NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO v_id;
        IF done THEN LEAVE read_loop; END IF;
        SET v_exists = 1;
        SET v_attempts = 0;
        WHILE v_exists > 0 AND v_attempts < 50 DO
            SET v_code = UPPER(SUBSTRING(MD5(CONCAT(RAND(), UNIX_TIMESTAMP(), v_id, v_attempts)), 1, 8));
            SELECT COUNT(*) INTO v_exists FROM `sxo_user` WHERE `invite_code` = v_code;
            SET v_attempts = v_attempts + 1;
        END WHILE;
        IF v_exists = 0 THEN
            UPDATE `sxo_user` SET `invite_code` = v_code WHERE `id` = v_id;
        END IF;
    END LOOP;
    CLOSE cur;
END//
DELIMITER ;

CALL `muying_fill_invite_code`();
DROP PROCEDURE IF EXISTS `muying_fill_invite_code`;

-- C2. 邀请码唯一索引
-- 执行前检查：SELECT COUNT(*) FROM sxo_user WHERE invite_code='' OR invite_code IS NULL; → 必须=0
-- 如果不为0，先执行C1
SET @index_name = 'uk_invite_code';
SELECT COUNT(*) INTO @index_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='sxo_user' AND INDEX_NAME=@index_name;
SET @sql = IF(@index_exists=0, 'ALTER TABLE `sxo_user` ADD UNIQUE INDEX `uk_invite_code` (`invite_code`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- C3. 邀请奖励去重 + 唯一约束
-- 执行前检查：SELECT inviter_id, invitee_id, trigger_event, COUNT(*) AS cnt FROM sxo_invite_reward GROUP BY inviter_id, invitee_id, trigger_event HAVING cnt > 1;
DELETE r1 FROM `sxo_invite_reward` r1
INNER JOIN `sxo_invite_reward` r2
ON r1.inviter_id = r2.inviter_id
   AND r1.invitee_id = r2.invitee_id
   AND r1.trigger_event = r2.trigger_event
   AND r1.id > r2.id;

SET @index_name = 'uk_inviter_invitee_event';
SELECT COUNT(*) INTO @index_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='sxo_invite_reward' AND INDEX_NAME=@index_name;
SET @sql = IF(@index_exists=0, 'ALTER TABLE `sxo_invite_reward` ADD UNIQUE INDEX `uk_inviter_invitee_event` (`inviter_id`, `invitee_id`, `trigger_event`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- C4. 枚举值漂移修复（仅当有旧脏数据时执行）
-- 执行前检查：SELECT DISTINCT stage FROM sxo_activity WHERE stage NOT IN ('prepare','pregnancy','postpartum','all','');
-- 如果有结果才执行以下UPDATE
UPDATE `sxo_activity` SET `stage` = 'pregnancy' WHERE `stage` = 'pregnant';
UPDATE `sxo_activity` SET `stage` = 'postpartum' WHERE `stage` IN ('newborn', 'infant');
UPDATE `sxo_activity` SET `category` = 'classroom' WHERE `category` IN ('maternity', 'other', 'class');
UPDATE `sxo_activity` SET `category` = 'lecture' WHERE `category` IN ('parenting', 'early_edu');
UPDATE `sxo_activity_signup` SET `stage` = 'pregnancy' WHERE `stage` = 'pregnant';
UPDATE `sxo_activity_signup` SET `stage` = 'postpartum' WHERE `stage` IN ('newborn', 'infant');
UPDATE `sxo_user` SET `current_stage` = 'pregnancy' WHERE `current_stage` = 'pregnant';
UPDATE `sxo_user` SET `current_stage` = 'postpartum' WHERE `current_stage` IN ('newborn', 'infant');

-- C5. 邀请奖励配置项（必须执行，否则奖励为0）
-- 使用 ON DUPLICATE KEY UPDATE 确保幂等，重复执行不会报错
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('100', '邀请注册奖励积分', '邀请人获得的积分奖励', '请填写邀请注册奖励积分', 'common', 'muying_invite_register_reward', UNIX_TIMESTAMP()),
('200', '邀请首单奖励积分', '被邀请人首单后邀请人获得的积分奖励', '请填写邀请首单奖励积分', 'common', 'muying_invite_first_order_reward', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `upd_time`=UNIX_TIMESTAMP();

-- C6. 后台运营菜单权限
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(0, '运营', 'activity', 'index', '', 15, 1, 'icon-admin-operation', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @op_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '活动管理', 'activity', 'index', '', 1, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @act_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@act_id, '活动详情', 'activity', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动添加/编辑', 'activity', 'saveinfo', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动保存', 'activity', 'save', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动删除', 'activity', 'delete', '', 4, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@act_id, '活动状态更新', 'activity', 'statusupdate', '', 5, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '报名管理', 'activitysignup', 'index', '', 2, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @signup_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@signup_id, '报名详情', 'activitysignup', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '签到核销', 'activitysignup', 'checkin', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '导出数据', 'activitysignup', 'export', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '邀请管理', 'invite', 'index', '', 3, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @invite_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@invite_id, '邀请详情', 'invite', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '数据报表', 'muyingstat', 'index', '', 4, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '反馈管理', 'feedback', 'index', '', 5, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @feedback_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@feedback_id, '反馈详情', 'feedback', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@feedback_id, '启用/禁用', 'feedback', 'statusupdate', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@feedback_id, '删除反馈', 'feedback', 'delete', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '邀请配置', 'inviteconfig', 'index', '', 6, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @inviteconfig_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@inviteconfig_id, '保存配置', 'inviteconfig', 'save', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '数据看板', 'dashboard', 'index', '', 7, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @dashboard_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@dashboard_id, '概览', 'dashboard', 'overview', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@dashboard_id, '趋势', 'dashboard', 'trend', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@dashboard_id, '生成快照', 'dashboard', 'generatesnapshot', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '用户标签', 'usertag', 'index', '', 8, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- C6b. 报名管理补齐缺失权限
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@signup_id, '确认报名', 'activitysignup', 'confirm', '', 4, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '取消报名', 'activitysignup', 'cancel', '', 5, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '批量确认', 'activitysignup', 'batchconfirm', '', 6, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '候补转正', 'activitysignup', 'waitlisttonormal', '', 7, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '签到码核销', 'activitysignup', 'codecheckin', '', 8, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@signup_id, '删除报名', 'activitysignup', 'delete', '', 9, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- C6c. 活动管理补齐审核权限
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@act_id, '活动审核', 'activity', 'review', '', 6, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- C6d. 反馈管理补齐审核权限
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@feedback_id, '审核反馈', 'feedback', 'review', '', 4, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- C6e. 邀请管理补齐操作权限
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@invite_id, '发放奖励', 'invite', 'grant', '', 2, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(@invite_id, '取消奖励', 'invite', 'cancel', '', 3, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- C6f. 用户运营菜单
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@op_id, '用户运营', 'muyinguser', 'index', '', 9, 1, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
SET @muyinguser_id = LAST_INSERT_ID();

INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(@muyinguser_id, '用户详情', 'muyinguser', 'detail', '', 1, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- C6g. 运营首页（数据看板）提升为第一个子菜单
UPDATE `sxo_power` SET `sort`=0 WHERE `pid`=@op_id AND `control`='dashboard' AND `action`='index';

-- C7. 隐藏一期不需要的功能菜单
-- 一期白名单：商品管理/订单管理/用户管理/文章管理/运营/系统管理/应用管理/站点管理/支付管理
-- 一期允许插件：brand/delivery/express（菜单保留可见）
-- 一期受控插件：coupon/signin/points（菜单隐藏，需功能开关开启后手动显示）
-- 一期禁用：多商户/门店/分销/钱包/积分商城/问答/博客/会员VIP/秒杀/礼品卡/送礼/投诉/发票/实名认证/扫码支付/直播/智能工具/仓库
UPDATE `sxo_power` SET `is_show`=0 WHERE `name` IN ('多商户', '商家入驻', '分销管理', '直播管理', '积分商城', '门店管理', '钱包管理', '问答管理', '博客管理', '会员等级', '限时秒杀', '优惠券', '签到', '礼品卡', '送礼', '投诉管理', '发票管理', '实名认证', '扫码支付', '智能工具', '仓库管理') OR `control` IN ('shop', 'distribution', 'weixinliveplayer', 'coin', 'realstore', 'wallet', 'ask', 'blog', 'membershiplevelvip', 'seckill', 'coupon', 'signin', 'giftcard', 'givegift', 'complaint', 'invoice', 'certificate', 'scanpay', 'intellectstools', 'warehouse');

-- C8. 强制关闭一期外功能开关（防止后台误配残留）
-- 一期核心功能开关（activity/invite/content/feedback）保持开启
-- coupon/signin/points 默认关闭，需后台按需开启（非现金、不可提现、仅自营）
UPDATE `sxo_config` SET `value`='0' WHERE `only_tag` IN ('feature_shop_enabled', 'feature_realstore_enabled', 'feature_distribution_enabled', 'feature_wallet_enabled', 'feature_coin_enabled', 'feature_ugc_enabled', 'feature_membership_enabled', 'feature_seckill_enabled', 'feature_coupon_enabled', 'feature_signin_enabled', 'feature_points_enabled', 'feature_video_enabled', 'feature_hospital_enabled', 'feature_giftcard_enabled', 'feature_givegift_enabled', 'feature_complaint_enabled', 'feature_invoice_enabled', 'feature_certificate_enabled', 'feature_scanpay_enabled', 'feature_live_enabled', 'feature_intellectstools_enabled');

-- C段回滚：
-- ALTER TABLE sxo_user DROP INDEX uk_invite_code;
-- ALTER TABLE sxo_invite_reward DROP INDEX uk_inviter_invitee_event;
-- DELETE FROM sxo_config WHERE only_tag IN ('muying_invite_register_reward', 'muying_invite_first_order_reward');
-- DELETE FROM sxo_power WHERE name='运营' OR control IN ('activity','activitysignup','invite','inviteconfig','dashboard','muyingstat','feedback','usertag');

-- ============================================================
-- D段：隐私安全与审计
-- ============================================================

-- D1. 审计日志表（同时服务 MuyingAuditLogService 和 MuyingLogService）
CREATE TABLE IF NOT EXISTS `sxo_muying_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int unsigned NOT NULL DEFAULT 0 COMMENT '管理员ID(审计场景)',
  `admin_username` char(60) NOT NULL DEFAULT '' COMMENT '管理员用户名(冗余)',
  `scene` char(30) NOT NULL DEFAULT '' COMMENT '操作场景(signup_export/feedback_export/user_export/sensitive_view)',
  `target_id` int unsigned NOT NULL DEFAULT 0 COMMENT '目标记录ID',
  `conditions` text COMMENT '查询条件JSON(不含明文敏感数据)',
  `export_count` int unsigned NOT NULL DEFAULT 0 COMMENT '导出/查看数量',
  `type` char(30) NOT NULL DEFAULT '' COMMENT '业务日志类型(activity_signup/activity_checkin/activity_confirm/invite_reward等)',
  `action` char(30) NOT NULL DEFAULT '' COMMENT '业务操作动作(create/update/cancel等)',
  `user_id` int unsigned NOT NULL DEFAULT 0 COMMENT '前端用户ID(业务日志场景)',
  `detail` varchar(500) NOT NULL DEFAULT '' COMMENT '业务日志详情',
  `status` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '状态(0失败/1成功)',
  `ip` char(45) NOT NULL DEFAULT '' COMMENT '操作IP',
  `remark` varchar(500) NOT NULL DEFAULT '' COMMENT '备注',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_scene` (`scene`),
  KEY `idx_type` (`type`),
  KEY `idx_user` (`user_id`),
  KEY `idx_time` (`add_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='审计与业务日志';

-- D2. 敏感数据查看/导出权限注册
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(780, 700, '敏感数据管理', 'Muyingsensitive', 'Index', '', 9, 0, '', UNIX_TIMESTAMP(), 0),
(781, 780, '查看敏感数据', 'Muyingsensitive', 'View', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(782, 780, '导出敏感数据', 'Muyingsensitive', 'Export', '', 1, 0, '', UNIX_TIMESTAMP(), 0);

-- D3. 超级管理员默认授予敏感数据权限
INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 780, UNIX_TIMESTAMP()),
(1, 781, UNIX_TIMESTAMP()),
(1, 782, UNIX_TIMESTAMP());

-- D4. 隐私加密密钥配置项占位（实际密钥通过 .env MUYING_PRIVACY_KEY 配置）
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('', '隐私加密密钥配置状态', '密钥通过.env的MUYING_PRIVACY_KEY配置，此处仅标记是否已配置(1已配置/0未配置)', '请确认密钥已配置', 'admin', 'muying_privacy_key_configured', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- D段回滚：
-- DROP TABLE IF EXISTS sxo_muying_audit_log;
-- DELETE FROM sxo_role_power WHERE power_id IN (780, 781, 782);
-- DELETE FROM sxo_power WHERE id IN (780, 781, 782);
-- DELETE FROM sxo_config WHERE only_tag = 'muying_privacy_key_configured';

-- D5. 合规拦截日志表（MuyingComplianceService 使用）
CREATE TABLE IF NOT EXISTS `sxo_muying_compliance_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int unsigned NOT NULL DEFAULT 0 COMMENT '管理员ID',
  `admin_username` varchar(60) NOT NULL DEFAULT '' COMMENT '管理员用户名',
  `feature_key` varchar(60) NOT NULL DEFAULT '' COMMENT '功能开关key',
  `action` varchar(30) NOT NULL DEFAULT '' COMMENT '操作类型(toggle_blocked/toggle_allowed/api_blocked)',
  `reason` varchar(500) NOT NULL DEFAULT '' COMMENT '拦截原因',
  `controller` varchar(60) NOT NULL DEFAULT '' COMMENT '控制器名',
  `api_action` varchar(60) NOT NULL DEFAULT '' COMMENT '方法名',
  `user_id` int unsigned NOT NULL DEFAULT 0 COMMENT '前端用户ID（API拦截时）',
  `ip` char(45) NOT NULL DEFAULT '' COMMENT '操作IP',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_feature` (`feature_key`),
  KEY `idx_time` (`add_time`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='合规拦截日志';

-- D6. 统计快照表（DashboardService 使用）
CREATE TABLE IF NOT EXISTS `sxo_muying_stat_snapshot` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `stat_date` char(10) NOT NULL DEFAULT '' COMMENT '统计日期(YYYY-MM-DD)',
  `metric_key` char(60) NOT NULL DEFAULT '' COMMENT '指标key',
  `metric_value` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT '指标值',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_metric` (`stat_date`, `metric_key`),
  KEY `idx_date` (`stat_date`),
  KEY `idx_metric` (`metric_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='统计快照';

-- D7. 合规中心菜单权限（id=770-775）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(770, 700, '合规中心', 'Muyingcompliance', 'Index', '', 8, 1, '', UNIX_TIMESTAMP(), 0),
(771, 770, '合规中心首页', 'Muyingcompliance', 'Index', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(772, 770, '功能开关管理', 'Muyingcompliance', 'Features', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(773, 770, '功能开关切换', 'Muyingcompliance', 'Toggle', '', 2, 0, '', UNIX_TIMESTAMP(), 0),
(774, 770, '资质状态保存', 'Muyingcompliance', 'SaveQualification', '', 3, 0, '', UNIX_TIMESTAMP(), 0),
(775, 770, '拦截日志', 'Muyingcompliance', 'Blocklogs', '', 4, 0, '', UNIX_TIMESTAMP(), 0);

INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 770, UNIX_TIMESTAMP()),
(1, 771, UNIX_TIMESTAMP()),
(1, 772, UNIX_TIMESTAMP()),
(1, 773, UNIX_TIMESTAMP()),
(1, 774, UNIX_TIMESTAMP()),
(1, 775, UNIX_TIMESTAMP());

-- D8. 一期功能开关配置项
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', '第三方商家入驻开关', '控制第三方商家入驻功能是否开放（需ICP经营许可证+EDI许可证）', '请选择是否开启', 'admin', 'feature_shop_enabled', UNIX_TIMESTAMP()),
('0', '门店/多门店开关', '控制门店/多门店功能是否开放（需ICP经营许可证+EDI许可证）', '请选择是否开启', 'admin', 'feature_realstore_enabled', UNIX_TIMESTAMP()),
('0', '分销/多级返佣开关', '控制分销/多级返佣功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_distribution_enabled', UNIX_TIMESTAMP()),
('0', '钱包/余额/提现开关', '控制钱包/余额/充值/提现功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_wallet_enabled', UNIX_TIMESTAMP()),
('0', '虚拟币开关', '控制虚拟币功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_coin_enabled', UNIX_TIMESTAMP()),
('0', 'UGC社区开关', '控制问答/博客/用户发帖功能是否开放（需ICP经营许可证+内容审核能力）', '请选择是否开启', 'admin', 'feature_ugc_enabled', UNIX_TIMESTAMP()),
('0', '会员等级VIP开关', '控制会员等级/付费VIP功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_membership_enabled', UNIX_TIMESTAMP()),
('0', '秒杀开关', '控制秒杀功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_seckill_enabled', UNIX_TIMESTAMP()),
('0', '礼品卡开关', '控制礼品卡功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_giftcard_enabled', UNIX_TIMESTAMP()),
('0', '送礼开关', '控制送礼功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_givegift_enabled', UNIX_TIMESTAMP()),
('0', '视频开关', '控制视频功能是否开放（需网络视听许可证）', '请选择是否开启', 'admin', 'feature_video_enabled', UNIX_TIMESTAMP()),
('0', '医疗咨询/问诊开关', '控制医疗咨询/问诊功能是否开放（需医疗机构执业许可证）', '请选择是否开启', 'admin', 'feature_hospital_enabled', UNIX_TIMESTAMP()),
('0', '投诉开关', '控制投诉功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_complaint_enabled', UNIX_TIMESTAMP()),
('0', '发票开关', '控制发票功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_invoice_enabled', UNIX_TIMESTAMP()),
('0', '证书开关', '控制证书功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_certificate_enabled', UNIX_TIMESTAMP()),
('0', '扫码支付开关', '控制扫码支付功能是否开放（需支付牌照）', '请选择是否开启', 'admin', 'feature_scanpay_enabled', UNIX_TIMESTAMP()),
('0', '微信直播开关', '控制微信直播功能是否开放（需网络文化经营许可证）', '请选择是否开启', 'admin', 'feature_live_enabled', UNIX_TIMESTAMP()),
('0', '智能工具开关', '控制智能工具功能是否开放（需ICP经营许可证）', '请选择是否开启', 'admin', 'feature_intellectstools_enabled', UNIX_TIMESTAMP()),
('0', '优惠券开关', '控制优惠券领取/使用功能是否开放（仅自营商品、非现金、不可提现）', '请选择是否开启', 'admin', 'feature_coupon_enabled', UNIX_TIMESTAMP()),
('0', '签到开关', '控制每日签到功能是否开放（非现金、不可提现、不可转让）', '请选择是否开启', 'admin', 'feature_signin_enabled', UNIX_TIMESTAMP()),
('0', '积分开关', '控制积分获取/消费功能是否开放（仅自营商品、不可提现、不可储值、不可转余额）', '请选择是否开启', 'admin', 'feature_points_enabled', UNIX_TIMESTAMP()),
('1', '活动报名开关', '控制官方活动报名功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_activity_enabled', UNIX_TIMESTAMP()),
('1', '一级邀请裂变开关', '控制一级邀请裂变功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_invite_enabled', UNIX_TIMESTAMP()),
('1', '官方内容开关', '控制文章/公告/首页装修等官方内容功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_content_enabled', UNIX_TIMESTAMP()),
('1', '用户反馈开关', '控制用户反馈/妈妈说功能是否开放（一期核心）', '请选择是否开启', 'admin', 'feature_feedback_enabled', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- D9. 资质门禁配置项
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', 'ICP备案状态', 'ICP备案进度（0备案中/1已备案），与ICP经营许可证不同', '请选择备案状态', 'admin', 'qualification_icp_filing', UNIX_TIMESTAMP()),
('0', 'ICP经营许可证资质', '是否已取得ICP经营许可证（控制第三方入驻、UGC社区、分销等平台型功能）', '请确认是否已取得', 'admin', 'qualification_icp_commercial', UNIX_TIMESTAMP()),
('0', 'EDI许可证资质', '是否已取得EDI许可证（控制多商户、多门店等入驻型功能）', '请确认是否已取得', 'admin', 'qualification_edi', UNIX_TIMESTAMP()),
('0', '医疗机构执业许可证资质', '是否已取得医疗机构执业许可证（控制互联网医院、医疗问诊功能）', '请确认是否已取得', 'admin', 'qualification_medical', UNIX_TIMESTAMP()),
('0', '网络文化经营许可证资质', '是否已取得网络文化经营许可证（控制直播、视频功能）', '请确认是否已取得', 'admin', 'qualification_live', UNIX_TIMESTAMP()),
('0', '支付牌照资质', '是否已取得支付牌照（控制钱包、余额、充值、提现、礼品卡、扫码支付功能）', '请确认是否已取得', 'admin', 'qualification_payment', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- D段回滚（追加）：
-- DROP TABLE IF EXISTS sxo_muying_compliance_log, sxo_muying_stat_snapshot, sxo_muying_sensitive_log;
-- DELETE FROM sxo_power WHERE id BETWEEN 770 AND 775;
-- DELETE FROM sxo_role_power WHERE power_id BETWEEN 770 AND 775;
-- DELETE FROM sxo_config WHERE only_tag LIKE 'feature_%_enabled';
-- DELETE FROM sxo_config WHERE only_tag LIKE 'qualification_%';

-- D10. 敏感词拦截日志表（MuyingStatService 统计引用，预留）
CREATE TABLE IF NOT EXISTS `sxo_muying_sensitive_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `content_type` char(30) NOT NULL DEFAULT '' COMMENT '内容类型(feedback/activity_name等)',
  `content_id` int unsigned NOT NULL DEFAULT 0 COMMENT '内容ID',
  `word` char(60) NOT NULL DEFAULT '' COMMENT '命中的敏感词',
  `ip` char(45) NOT NULL DEFAULT '' COMMENT '提交IP',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '拦截时间',
  PRIMARY KEY (`id`),
  KEY `idx_time` (`add_time`),
  KEY `idx_type` (`content_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='敏感词拦截日志';
