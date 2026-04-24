-- ============================================================
-- [MUYING-二开] 商品母婴属性迁移：新增母婴行业字段 + 风险类目 + 资质状态
-- 作用：为商品表新增母婴适配字段和风险控制字段
-- 兼容：MySQL 5.7.44+（不使用 MySQL 8.0+ 专属语法）
-- 幂等性：使用 information_schema 检查字段是否存在，可重复执行
-- 执行时机：在 muying-final-migration.sql 之后执行
-- 回滚：见文件末尾
-- ============================================================

SET @dbname = DATABASE();
SET @tablename = 'sxo_goods';

-- muying_stage：适用阶段（逗号分隔，覆盖原 stage 字段语义）
-- 原 stage 字段已存在，此处重命名语义不变，仅新增索引
SET @idx_name = 'idx_muying_stage';
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND INDEX_NAME=@idx_name;
SET @sql = IF(@idx_exists=0, 'ALTER TABLE `sxo_goods` ADD INDEX `idx_muying_stage` (`stage`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- min_baby_month_age：最小适用月龄
SET @colname = 'min_baby_month_age';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `min_baby_month_age` smallint unsigned NOT NULL DEFAULT 0 COMMENT ''最小适用月龄(0=不限)'' AFTER `selling_point`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- max_baby_month_age：最大适用月龄
SET @colname = 'max_baby_month_age';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `max_baby_month_age` smallint unsigned NOT NULL DEFAULT 0 COMMENT ''最大适用月龄(0=不限)'' AFTER `min_baby_month_age`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- focus_areas：关注方向
SET @colname = 'focus_areas';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `focus_areas` varchar(200) NOT NULL DEFAULT '''' COMMENT ''关注方向(逗号分隔:nutrition,care,safety,education,comfort)'' AFTER `max_baby_month_age`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- risk_category：商品风险类目
SET @colname = 'risk_category';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `risk_category` char(20) NOT NULL DEFAULT ''normal'' COMMENT ''风险类目(normal/food/special_food/medical_device/medicine/service)'' AFTER `focus_areas`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- qualification_status：资质状态
SET @colname = 'qualification_status';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `qualification_status` char(20) NOT NULL DEFAULT ''none_required'' COMMENT ''资质状态(none_required/pending/approved/rejected/forbidden)'' AFTER `risk_category`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- qualification_remark：资质备注
SET @colname = 'qualification_remark';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `qualification_remark` varchar(200) NOT NULL DEFAULT '''' COMMENT ''资质备注'' AFTER `qualification_status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_muying_recommend：是否母婴推荐
SET @colname = 'is_muying_recommend';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `is_muying_recommend` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''是否母婴推荐(0否/1是)'' AFTER `qualification_remark`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- muying_sort_level：母婴排序权重
SET @colname = 'muying_sort_level';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_goods` ADD COLUMN `muying_sort_level` int unsigned NOT NULL DEFAULT 0 COMMENT ''母婴排序权重(越大越靠前)'' AFTER `is_muying_recommend`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- risk_category 索引
SET @idx_name = 'idx_risk_category';
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND INDEX_NAME=@idx_name;
SET @sql = IF(@idx_exists=0, 'ALTER TABLE `sxo_goods` ADD INDEX `idx_risk_category` (`risk_category`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_muying_recommend 索引
SET @idx_name = 'idx_is_muying_recommend';
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND INDEX_NAME=@idx_name;
SET @sql = IF(@idx_exists=0, 'ALTER TABLE `sxo_goods` ADD INDEX `idx_is_muying_recommend` (`is_muying_recommend`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 验证查询
-- ============================================================
-- SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sxo_goods' AND COLUMN_NAME IN ('stage','selling_point','min_baby_month_age','max_baby_month_age','focus_areas','risk_category','qualification_status','qualification_remark','is_muying_recommend','muying_sort_level');

-- ============================================================
-- 回滚
-- ============================================================
-- ALTER TABLE sxo_goods DROP INDEX idx_muying_stage;
-- ALTER TABLE sxo_goods DROP COLUMN min_baby_month_age;
-- ALTER TABLE sxo_goods DROP COLUMN max_baby_month_age;
-- ALTER TABLE sxo_goods DROP COLUMN focus_areas;
-- ALTER TABLE sxo_goods DROP COLUMN risk_category;
-- ALTER TABLE sxo_goods DROP COLUMN qualification_status;
-- ALTER TABLE sxo_goods DROP COLUMN qualification_remark;
-- ALTER TABLE sxo_goods DROP COLUMN is_muying_recommend;
-- ALTER TABLE sxo_goods DROP COLUMN muying_sort_level;
-- ALTER TABLE sxo_goods DROP INDEX idx_risk_category;
-- ALTER TABLE sxo_goods DROP INDEX idx_is_muying_recommend;
