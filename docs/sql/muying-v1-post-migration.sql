-- ============================================================
-- 禧孕 V1.0 后续增量迁移 — 统一入口
-- 在 muying-final-migration.sql 之后执行
-- 幂等性：所有语句可安全重复执行
-- 兼容：MySQL 5.7.44+
-- ============================================================
--
-- 执行顺序（必须按此顺序执行）：
--   1. 先执行 docs/muying-final-migration.sql（主迁移）
--   2. 再执行本文件（后续增量迁移）
--
-- 本文件包含以下迁移：
--   P1. 反馈表增加 type 字段 + idx_type 索引
--   P2. 隐私数据管理后台权限菜单（790-792）
--   P3. 内容合规敏感词表 + 合规日志表
--   P4. 内容合规后台权限菜单（793-796）
--
-- 执行命令：
--   mysql -u root -p sxo < docs/sql/muying-v1-post-migration.sql
-- ============================================================

-- ============================================================
-- P1. 反馈表增加 type 字段（幂等：information_schema 检查）
-- ============================================================

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

-- ============================================================
-- P2. 隐私数据管理后台权限菜单（幂等：INSERT IGNORE）
-- ============================================================

INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(790, 700, '隐私数据管理', 'Muyingprivacy', 'Index', '', 10, 1, '', UNIX_TIMESTAMP(), 0),
(791, 790, '用户数据查询', 'Muyingprivacy', 'Search', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(792, 790, '数据匿名化', 'Muyingprivacy', 'Anonymize', '', 1, 0, '', UNIX_TIMESTAMP(), 0);

INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 790, UNIX_TIMESTAMP()),
(1, 791, UNIX_TIMESTAMP()),
(1, 792, UNIX_TIMESTAMP());

-- ============================================================
-- P3. 内容合规敏感词表 + 合规日志表（幂等：CREATE TABLE IF NOT EXISTS）
-- ============================================================

CREATE TABLE IF NOT EXISTS `sxo_muying_content_sensitive_word` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `word` varchar(60) NOT NULL DEFAULT '' COMMENT '敏感词',
  `risk` char(10) NOT NULL DEFAULT 'high' COMMENT '风险级别(high高风险/low低风险)',
  `is_enable` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否启用(0否/1是)',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '添加时间',
  `upd_time` int unsigned NOT NULL DEFAULT 0 COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_word` (`word`),
  KEY `idx_risk` (`risk`),
  KEY `idx_enable` (`is_enable`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='内容合规敏感词配置';

CREATE TABLE IF NOT EXISTS `sxo_muying_content_compliance_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `content_type` char(20) NOT NULL DEFAULT '' COMMENT '内容类型(goods商品/article文章/activity活动)',
  `content_id` int unsigned NOT NULL DEFAULT 0 COMMENT '内容ID',
  `word` varchar(60) NOT NULL DEFAULT '' COMMENT '命中的敏感词',
  `risk` char(10) NOT NULL DEFAULT '' COMMENT '风险级别(high/low)',
  `field` varchar(30) NOT NULL DEFAULT '' COMMENT '命中字段',
  `admin_id` int unsigned NOT NULL DEFAULT 0 COMMENT '操作管理员ID',
  `action` char(20) NOT NULL DEFAULT '' COMMENT '操作(blocked阻止/confirmed确认保存)',
  `ip` char(45) NOT NULL DEFAULT '' COMMENT '操作IP',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_content` (`content_type`, `content_id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_action` (`action`),
  KEY `idx_time` (`add_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='内容合规日志';

-- ============================================================
-- P4. 内容合规后台权限菜单（幂等：INSERT IGNORE）
-- ============================================================

INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(793, 700, '内容合规', 'Contentsensitiveword', 'Index', '', 11, 1, '', UNIX_TIMESTAMP(), 0),
(794, 793, '添加敏感词', 'Contentsensitiveword', 'Save', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(795, 793, '删除敏感词', 'Contentsensitiveword', 'Delete', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(796, 793, '查看合规日志', 'Contentsensitiveword', 'LogList', '', 2, 0, '', UNIX_TIMESTAMP(), 0);

INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 793, UNIX_TIMESTAMP()),
(1, 794, UNIX_TIMESTAMP()),
(1, 795, UNIX_TIMESTAMP()),
(1, 796, UNIX_TIMESTAMP());
