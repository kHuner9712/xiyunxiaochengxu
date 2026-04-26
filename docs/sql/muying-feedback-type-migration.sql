-- ============================================================
-- [MUYING-二开] 反馈表增加类型字段
-- 用途：支持"数据删除/隐私请求"等反馈类型
-- 兼容：MySQL 5.7.44+（不使用 ADD COLUMN IF NOT EXISTS）
-- 幂等性：使用 information_schema 检查字段/索引是否存在，可安全重复执行
-- ============================================================

-- 1. 添加 type 字段（如果不存在）
SET @dbname = DATABASE();
SET @tablename = 'sxo_muying_feedback';
SET @columnname = 'type';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `sxo_muying_feedback` ADD COLUMN `type` char(30) NOT NULL DEFAULT ''feedback'' COMMENT ''反馈类型(feedback反馈/suggestion建议/complaint投诉/privacy_request隐私请求)'' AFTER `user_id`'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. 添加 idx_type 索引（如果不存在）
SET @indexname = 'idx_type';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND INDEX_NAME = @indexname) > 0,
  'SELECT 1',
  'ALTER TABLE `sxo_muying_feedback` ADD INDEX `idx_type` (`type`)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
