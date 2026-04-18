-- MuyingFeedback 表（妈妈说/用户反馈）
CREATE TABLE IF NOT EXISTS `sxo_muying_feedback` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) unsigned NOT NULL DEFAULT 0,
  `nickname` varchar(60) NOT NULL DEFAULT '',
  `avatar` varchar(255) NOT NULL DEFAULT '',
  `content` text NOT NULL,
  `stage` varchar(30) NOT NULL DEFAULT '',
  `sort_level` int(11) NOT NULL DEFAULT 0,
  `is_enable` tinyint(1) NOT NULL DEFAULT 1,
  `is_delete_time` int(11) unsigned NOT NULL DEFAULT 0,
  `add_time` int(11) unsigned NOT NULL DEFAULT 0,
  `upd_time` int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_enable` (`is_enable`, `is_delete_time`),
  KEY `idx_sort` (`sort_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='母婴用户反馈';
