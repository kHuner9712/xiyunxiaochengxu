-- ============================================================
-- [MUYING-二开] 合规中心迁移：菜单权限 + 合规拦截日志表 + ICP备案配置
-- 作用：注册合规中心菜单到后台，创建合规拦截日志表，新增 ICP 备案状态配置
-- 兼容：MySQL 5.7.44+
-- 幂等性：使用 INSERT IGNORE 和 CREATE TABLE IF NOT EXISTS，可重复执行
-- 执行时机：在 muying-admin-power-migration.sql 之后执行
-- 回滚：见文件末尾
-- ============================================================

-- ============================================================
-- 一、合规中心菜单注册（id=760 起，接在功能开关 751 之后）
-- ============================================================

-- 合规中心（二级菜单，排在功能开关之后）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(760, 700, '合规中心', 'Muyingcompliance', 'Index', '', 7, 1, '', UNIX_TIMESTAMP(), 0),
(761, 760, '合规中心首页', 'Muyingcompliance', 'Index', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(762, 760, '功能开关管理', 'Muyingcompliance', 'Features', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(763, 760, '功能开关切换', 'Muyingcompliance', 'Toggle', '', 2, 0, '', UNIX_TIMESTAMP(), 0),
(764, 760, '资质状态保存', 'Muyingcompliance', 'SaveQualification', '', 3, 0, '', UNIX_TIMESTAMP(), 0),
(765, 760, '拦截日志', 'Muyingcompliance', 'Blocklogs', '', 4, 0, '', UNIX_TIMESTAMP(), 0);

-- 将合规中心权限分配给超级管理员角色（role_id=1）
INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 760, UNIX_TIMESTAMP()),
(1, 761, UNIX_TIMESTAMP()),
(1, 762, UNIX_TIMESTAMP()),
(1, 763, UNIX_TIMESTAMP()),
(1, 764, UNIX_TIMESTAMP()),
(1, 765, UNIX_TIMESTAMP());

-- ============================================================
-- 二、合规拦截日志表
-- 用途：记录管理员尝试开启高风险功能但被资质门禁拦截的操作
-- ============================================================
CREATE TABLE IF NOT EXISTS `sxo_muying_compliance_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int unsigned NOT NULL DEFAULT 0 COMMENT '管理员ID',
  `admin_username` varchar(60) NOT NULL DEFAULT '' COMMENT '管理员用户名',
  `feature_key` varchar(60) NOT NULL DEFAULT '' COMMENT '功能开关key',
  `action` varchar(30) NOT NULL DEFAULT '' COMMENT '操作类型(toggle_blocked)',
  `reason` varchar(500) NOT NULL DEFAULT '' COMMENT '拦截原因',
  `ip` char(45) NOT NULL DEFAULT '' COMMENT '操作IP',
  `add_time` int unsigned NOT NULL DEFAULT 0 COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_feature` (`feature_key`),
  KEY `idx_time` (`add_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='合规拦截日志';

-- ============================================================
-- 三、ICP备案状态配置项
-- 用途：记录 ICP 备案进度（备案中/已备案），与 ICP 经营许可证是不同概念
-- ============================================================
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', 'ICP备案状态', 'ICP备案进度（0备案中/1已备案），与ICP经营许可证不同', '请选择备案状态', 'admin', 'qualification_icp_filing', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 验证查询
-- ============================================================
-- SELECT id, pid, name, control, action FROM sxo_power WHERE id >= 760 ORDER BY id;
-- SELECT COUNT(*) AS total FROM sxo_muying_compliance_log;
-- SELECT only_tag, value FROM sxo_config WHERE only_tag = 'qualification_icp_filing';

-- ============================================================
-- 回滚
-- ============================================================
-- DELETE FROM sxo_power WHERE id BETWEEN 760 AND 765;
-- DELETE FROM sxo_role_power WHERE power_id BETWEEN 760 AND 765;
-- DROP TABLE IF EXISTS sxo_muying_compliance_log;
-- DELETE FROM sxo_config WHERE only_tag = 'qualification_icp_filing';
