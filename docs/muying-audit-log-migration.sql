-- ============================================================
-- 孕禧审计日志表迁移
-- 作用：创建 muying_audit_log 表，用于记录关键业务操作审计日志
-- 执行时机：数据库初始化后执行一次即可
-- ============================================================

CREATE TABLE IF NOT EXISTS `sxo_muying_audit_log` (
    `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
    `type` varchar(32) NOT NULL DEFAULT '' COMMENT '日志类型: activity_signup/activity_checkin/invite_reward/user_stage等',
    `action` varchar(32) NOT NULL DEFAULT '' COMMENT '操作: create/update/delete/toggle',
    `user_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '操作用户ID',
    `target_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '目标对象ID',
    `detail` text COMMENT '操作详情JSON',
    `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1成功 0失败',
    `ip` varchar(45) NOT NULL DEFAULT '' COMMENT '操作IP',
    `add_time` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '操作时间',
    PRIMARY KEY (`id`),
    KEY `idx_type` (`type`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_add_time` (`add_time`),
    KEY `idx_type_action` (`type`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='母婴业务审计日志';
