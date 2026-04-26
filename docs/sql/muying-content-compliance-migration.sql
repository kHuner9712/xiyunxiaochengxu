-- ============================================================
-- 孕禧一期：内容合规敏感词 + 合规日志表
-- 幂等性：CREATE TABLE IF NOT EXISTS
-- 兼容：MySQL 5.7.44+
-- ============================================================

-- 1. 敏感词配置表
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

-- 2. 内容合规日志表
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
