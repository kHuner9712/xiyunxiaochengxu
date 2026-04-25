-- ============================================================
-- [MUYING-二开] 合规中心迁移：菜单权限 + 合规拦截日志表 + ICP备案配置
-- 作用：注册合规中心菜单到后台，创建合规拦截日志表，新增 ICP 备案状态配置
-- 兼容：MySQL 5.7.44+
-- 幂等性：使用 INSERT IGNORE 和 CREATE TABLE IF NOT EXISTS，可重复执行
-- 执行时机：在 muying-admin-power-migration.sql 之后执行
-- 重要：合规中心使用 id=770-775，避免与数据看板 id=760 冲突
-- 回滚：见文件末尾
-- ============================================================

-- ============================================================
-- 一、旧环境修复：如果之前错误执行过 id=760-765 的合规中心菜单
-- 必须在插入 770-775 之前执行，否则旧数据可能冲突
-- 识别条件：id=760 的 control='Muyingcompliance'（而非 'Muyingstat'）
-- 修复动作：删除旧 760-765 合规中心权限 → 重新插入 770-775
-- 注意：不使用多语句 PREPARE，每条 DELETE 独立执行
-- ============================================================

-- 步骤 1：清理旧 role_power（仅当 id=760 是合规中心时）
DELETE FROM `sxo_role_power` WHERE `power_id` BETWEEN 760 AND 765
AND EXISTS (SELECT 1 FROM (SELECT 1 FROM `sxo_power` WHERE `id` = 760 AND `control` = 'Muyingcompliance') AS _tmp);

-- 步骤 2：清理旧 power（仅当 id=760 是合规中心时，且只删合规中心相关行）
DELETE FROM `sxo_power` WHERE `id` BETWEEN 760 AND 765
AND `control` = 'Muyingcompliance';

-- 步骤 3：清理可能错挂在旧 760 下的子权限（761-765 的 pid=760 但 control 不是 Muyingstat）
DELETE FROM `sxo_power` WHERE `pid` = 760 AND `control` = 'Muyingcompliance';

-- ============================================================
-- 二、合规中心菜单注册（id=770 起，避免与数据看板 id=760 冲突）
-- ============================================================

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

-- ============================================================
-- 三、合规拦截日志表
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
-- 四、ICP备案状态配置项
-- ============================================================
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', 'ICP备案状态', 'ICP备案进度（0备案中/1已备案），与ICP经营许可证不同', '请选择备案状态', 'admin', 'qualification_icp_filing', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `describe`=VALUES(`describe`), `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 验证查询
-- ============================================================
-- SELECT id, pid, name, control, action FROM sxo_power WHERE id IN (760, 770, 771, 772, 773, 774, 775) ORDER BY id;
-- SELECT COUNT(*) AS total FROM sxo_muying_compliance_log;
-- SELECT only_tag, value FROM sxo_config WHERE only_tag = 'qualification_icp_filing';

-- ============================================================
-- 回滚
-- ============================================================
-- DELETE FROM sxo_power WHERE id BETWEEN 770 AND 775;
-- DELETE FROM sxo_role_power WHERE power_id BETWEEN 770 AND 775;
-- DROP TABLE IF EXISTS sxo_muying_compliance_log;
-- DELETE FROM sxo_config WHERE only_tag = 'qualification_icp_filing';
