-- ============================================================
-- [MUYING-二开] 隐私安全迁移：敏感字段加密 + phone_hash 去重 + 审计日志表
-- 作用：为活动报名、用户反馈中的手机号/姓名/联系方式增加加密存储和脱敏展示能力
-- 兼容：MySQL 5.7.44+（不使用 MySQL 8.0+ 专属语法）
-- 幂等性：使用 information_schema 检查字段是否存在，可重复执行
-- 执行时机：在 muying-final-migration.sql 之后执行
-- 风险提示：
--   - 执行前必须备份数据库
--   - 旧数据不会自动加密，需运行数据迁移脚本（见文档说明）
--   - 加密密钥必须通过 .env 或 sxo_config 配置，不要硬编码
-- 回滚：见文件末尾
-- ============================================================

SET @dbname = DATABASE();

-- ============================================================
-- 一、sxo_activity_signup 新增 phone_hash 字段
-- 用途：手机号去重校验，替代明文 phone 字段做 WHERE 条件
-- ============================================================
SET @tablename = 'sxo_activity_signup';
SET @colname = 'phone_hash';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `phone_hash` char(64) NOT NULL DEFAULT '''' COMMENT ''手机号哈希(sha256,用于去重)'' AFTER `phone`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone_hash 索引（加速去重查询）
SET @idx_name = 'idx_phone_hash';
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND INDEX_NAME=@idx_name;
SET @sql = IF(@idx_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD INDEX `idx_phone_hash` (`phone_hash`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 二、sxo_activity_signup 新增 privacy_version 字段
-- 用途：标记数据使用的隐私加密版本，便于后续迁移
-- ============================================================
SET @colname = 'privacy_version';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_activity_signup` ADD COLUMN `privacy_version` tinyint unsigned NOT NULL DEFAULT 0 COMMENT ''隐私加密版本(0明文/1AES加密)'' AFTER `phone_hash`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 三、sxo_muying_feedback 新增 contact_hash 字段
-- 用途：联系方式去重校验
-- ============================================================
SET @tablename = 'sxo_muying_feedback';
SET @colname = 'contact_hash';
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@colname;
SET @sql = IF(@col_exists=0, 'ALTER TABLE `sxo_muying_feedback` ADD COLUMN `contact_hash` char(64) NOT NULL DEFAULT '''' COMMENT ''联系方式哈希(sha256)'' AFTER `contact`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 四、审计日志表
-- 用途：记录敏感数据导出、查看等操作，满足合规审计要求
-- ============================================================
CREATE TABLE IF NOT EXISTS `sxo_muying_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int unsigned NOT NULL DEFAULT 0 COMMENT '管理员ID',
  `scene` char(30) NOT NULL DEFAULT '' COMMENT '操作场景(signup_export/feedback_export/user_export/sensitive_view)',
  `conditions` text COMMENT '查询条件JSON',
  `export_count` int unsigned NOT NULL DEFAULT 0 COMMENT '导出/查看数量',
  `ip` char(45) NOT NULL DEFAULT '' COMMENT '操作IP',
  `remark` varchar(500) NOT NULL DEFAULT '' COMMENT '备注',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_scene` (`scene`),
  KEY `idx_time` (`add_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='隐私审计日志';

-- ============================================================
-- 五、加密密钥配置项
-- 用途：存储 AES-256-CBC 加密密钥（通过 .env 优先读取）
-- 注意：密钥本身不存储在数据库中，仅存储一个占位配置项
-- 实际密钥通过 .env 的 MUYING_PRIVACY_KEY 环境变量配置
-- ============================================================
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('', '隐私加密密钥配置状态', '密钥通过.env的MUYING_PRIVACY_KEY配置，此处仅标记是否已配置(1已配置/0未配置)', '请确认密钥已配置', 'admin', 'muying_privacy_key_configured', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 六、旧数据迁移脚本（需手动执行）
-- 以下 SQL 将现有明文手机号/姓名加密并生成 phone_hash
-- 执行前提：已配置 MUYING_PRIVACY_KEY 密钥
-- 执行方式：通过后端命令行脚本执行，不能直接在 MySQL 中执行加密
-- 见：scripts/migrate-encrypt-sensitive.php
-- ============================================================

-- 验证查询：
-- SELECT COUNT(*) AS total, SUM(CASE WHEN phone_hash='' THEN 1 ELSE 0 END) AS missing_hash, SUM(CASE WHEN privacy_version=0 THEN 1 ELSE 0 END) AS plaintext_count FROM sxo_activity_signup WHERE is_delete_time=0;
-- SELECT COUNT(*) AS total FROM sxo_muying_audit_log;

-- ============================================================
-- 回滚
-- ============================================================
-- ALTER TABLE sxo_activity_signup DROP COLUMN phone_hash, DROP COLUMN privacy_version;
-- ALTER TABLE sxo_activity_signup DROP INDEX idx_phone_hash;
-- ALTER TABLE sxo_muying_feedback DROP COLUMN contact_hash;
-- DROP TABLE IF EXISTS sxo_muying_audit_log;
-- DELETE FROM sxo_config WHERE only_tag = 'muying_privacy_key_configured';
