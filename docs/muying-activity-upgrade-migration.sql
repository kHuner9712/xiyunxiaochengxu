-- ============================================================
-- 孕禧母婴 活动中心升级 SQL（候补/签到码/复盘/分类重构/状态机）
-- ============================================================
--
-- 【适用场景】
--   在已有 muying-final-migration.sql 基础上增量执行
--
-- 【执行顺序】
--   D1 → D2 → D3 → D4，严格按顺序执行
--
-- 【风险提示】
--   - 执行前必须备份数据库
--   - D1 会修改已有活动分类枚举值，不可回滚
--   - D3 唯一索引只能加一次
--
-- 【MySQL 版本要求】
--   标准 MySQL 5.7.44
--   不依赖 MySQL 8.0+ 专属语法
--
-- 【表前缀】
--   本文件使用 sxo_ 前缀
--
-- 【回滚提示】
--   见每段末尾的回滚 SQL
-- ============================================================


-- ============================================================
-- D1. 活动表新增字段 + 分类枚举迁移
-- ============================================================

-- D1-1. 活动类型（offline/online_info）
SET @dbname = DATABASE();
SET @tablename = 'sxo_activity';
SET @colname = 'activity_type';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `activity_type` char(20) NOT NULL DEFAULT ''offline'' COMMENT ''活动类型(offline线下/online_info线上图文)'' AFTER `category`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-2. 活动状态（draft/published/signing/full/ended/cancelled）
SET @colname = 'activity_status';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `activity_status` char(20) NOT NULL DEFAULT ''draft'' COMMENT ''活动状态(draft草稿/published已发布/signing报名中/full已满员/ended已结束/cancelled已取消)'' AFTER `activity_type`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-3. 候补名额
SET @colname = 'waitlist_count';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `waitlist_count` int unsigned NOT NULL DEFAULT 0 COMMENT ''候补名额(0不允许候补)'' AFTER `max_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-4. 已候补人数
SET @colname = 'waitlist_signup_count';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `waitlist_signup_count` int unsigned NOT NULL DEFAULT 0 COMMENT ''已候补人数'' AFTER `waitlist_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-5. 是否允许候补（冗余便捷字段）
SET @colname = 'allow_waitlist';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `allow_waitlist` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否允许候补(0否/1是)'' AFTER `waitlist_signup_count`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-6. 签到码开关
SET @colname = 'signup_code_enabled';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `signup_code_enabled` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否启用签到码(0否/1是)'' AFTER `allow_waitlist`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-7. 是否需要定位签到
SET @colname = 'require_location_checkin';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `require_location_checkin` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否需要定位签到(0否/1是)'' AFTER `signup_code_enabled`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-8. 纬度
SET @colname = 'latitude';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `latitude` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT ''纬度'' AFTER `require_location_checkin`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-9. 经度
SET @colname = 'longitude';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity` ADD COLUMN `longitude` decimal(10,6) NOT NULL DEFAULT 0.000000 COMMENT ''经度'' AFTER `latitude`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D1-10. 分类枚举迁移：旧值 → 新值
-- classroom → pregnancy_class
-- lecture → parent_child
-- trial → product_trial
-- holiday → member_day
-- checkin → public_welfare
-- salon 保持不变
UPDATE `sxo_activity` SET `category` = 'pregnancy_class' WHERE `category` = 'classroom';
UPDATE `sxo_activity` SET `category` = 'parent_child' WHERE `category` = 'lecture';
UPDATE `sxo_activity` SET `category` = 'product_trial' WHERE `category` = 'trial';
UPDATE `sxo_activity` SET `category` = 'member_day' WHERE `category` = 'holiday';
UPDATE `sxo_activity` SET `category` = 'public_welfare' WHERE `category` = 'checkin';

-- D1-11. 活动状态初始化：已有活动按 is_enable 设置初始状态
UPDATE `sxo_activity` SET `activity_status` = 'published' WHERE `is_enable` = 1 AND `activity_status` = 'draft';
UPDATE `sxo_activity` SET `activity_status` = 'cancelled' WHERE `is_enable` = 0 AND `activity_status` = 'draft' AND `is_delete_time` = 0;

-- D1-12. allow_waitlist 初始化：根据 waitlist_count > 0 设置
UPDATE `sxo_activity` SET `allow_waitlist` = 1 WHERE `waitlist_count` > 0;


-- ============================================================
-- D2. 报名表新增字段
-- ============================================================

SET @tablename = 'sxo_activity_signup';

-- D2-1. 是否候补
SET @colname = 'is_waitlist';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `is_waitlist` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否候补(0否/1是)'' AFTER `privacy_version`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D2-2. 候补转正时间
SET @colname = 'waitlist_to_normal_time';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `waitlist_to_normal_time` int unsigned NOT NULL DEFAULT 0 COMMENT ''候补转正时间'' AFTER `is_waitlist`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D2-3. 签到码（报名成功时自动生成）
SET @colname = 'signup_code';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `signup_code` char(12) NOT NULL DEFAULT '''' COMMENT ''签到码'' AFTER `waitlist_to_normal_time`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D2-4. 隐私版本号
SET @colname = 'privacy_version';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `privacy_version` tinyint unsigned NOT NULL DEFAULT 1 COMMENT ''隐私协议版本'' AFTER `privacy_agreed_time`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D2-5. 为已有报名记录生成签到码
UPDATE `sxo_activity_signup` SET `signup_code` = UPPER(SUBSTRING(MD5(CONCAT(id, activity_id, user_id, add_time)), 1, 8)) WHERE `signup_code` = '' AND `is_delete_time` = 0;


-- ============================================================
-- D3. 索引
-- ============================================================

-- D3-1. 活动状态索引
SET @index_name = 'idx_activity_status';
SELECT COUNT(*) INTO @index_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='sxo_activity' AND INDEX_NAME=@index_name;
SET @sql = IF(@index_exists=0, 'ALTER TABLE `sxo_activity` ADD INDEX `idx_activity_status` (`activity_status`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D3-2. 签到码唯一索引
SET @index_name = 'uk_signup_code';
SELECT COUNT(*) INTO @index_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='sxo_activity_signup' AND INDEX_NAME=@index_name;
SET @sql = IF(@index_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD UNIQUE INDEX `uk_signup_code` (`signup_code`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- D3-3. 候补状态索引
SET @index_name = 'idx_is_waitlist';
SELECT COUNT(*) INTO @index_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME='sxo_activity_signup' AND INDEX_NAME=@index_name;
SET @sql = IF(@index_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD INDEX `idx_is_waitlist` (`is_waitlist`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ============================================================
-- D4. 后台菜单权限补充
-- ============================================================

-- D4-1. 候补转正权限（幂等：仅当不存在时插入）
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`)
SELECT `id`, '候补转正', 'activitysignup', 'waitlisttonormal', '', 4, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `sxo_power` WHERE `control` = 'activitysignup' AND `action` = 'index' AND `is_show` = 1
AND NOT EXISTS (SELECT 1 FROM `sxo_power` AS _sub WHERE _sub.control = 'activitysignup' AND _sub.action = 'waitlisttonormal')
LIMIT 1;

-- D4-2. 活动复盘权限（幂等：仅当不存在时插入）
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`)
SELECT `id`, '活动复盘', 'activity', 'review', '', 6, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `sxo_power` WHERE `control` = 'activity' AND `action` = 'index' AND `is_show` = 1
AND NOT EXISTS (SELECT 1 FROM `sxo_power` AS _sub WHERE _sub.control = 'activity' AND _sub.action = 'review')
LIMIT 1;

-- D4-3. 签到码核销权限（幂等：仅当不存在时插入）
INSERT INTO `sxo_power` (`pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`)
SELECT `id`, '签到码核销', 'activitysignup', 'codecheckin', '', 5, 0, '', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM `sxo_power` WHERE `control` = 'activitysignup' AND `action` = 'index' AND `is_show` = 1
AND NOT EXISTS (SELECT 1 FROM `sxo_power` AS _sub WHERE _sub.control = 'activitysignup' AND _sub.action = 'codecheckin')
LIMIT 1;


-- D段回滚：
-- ALTER TABLE sxo_activity DROP COLUMN activity_type, DROP COLUMN activity_status, DROP COLUMN waitlist_count, DROP COLUMN waitlist_signup_count, DROP COLUMN allow_waitlist, DROP COLUMN signup_code_enabled, DROP COLUMN require_location_checkin, DROP COLUMN latitude, DROP COLUMN longitude;
-- ALTER TABLE sxo_activity_signup DROP COLUMN is_waitlist, DROP COLUMN waitlist_to_normal_time, DROP COLUMN signup_code, DROP COLUMN privacy_version;
-- ALTER TABLE sxo_activity DROP INDEX idx_activity_status;
-- ALTER TABLE sxo_activity_signup DROP INDEX uk_signup_code, DROP INDEX idx_is_waitlist;
-- DELETE FROM sxo_power WHERE control='activitysignup' AND action='waitlisttonormal';
-- DELETE FROM sxo_power WHERE control='activity' AND action='review';
-- DELETE FROM sxo_power WHERE control='activitysignup' AND action='codecheckin';
