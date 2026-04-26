-- ============================================================
-- 孕禧一期：内容合规敏感词管理 - 后台权限菜单注册迁移
-- 幂等性：使用 INSERT IGNORE，可重复执行
-- 兼容：MySQL 5.7.44+
-- ============================================================

-- 内容合规管理（二级菜单，挂在孕禧运营 700 下，sort=9）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(780, 700, '内容合规', 'Contentsensitiveword', 'Index', '', 9, 1, '', UNIX_TIMESTAMP(), 0),
(781, 780, '添加敏感词', 'Contentsensitiveword', 'Save', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(782, 780, '删除敏感词', 'Contentsensitiveword', 'Delete', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(783, 780, '查看合规日志', 'Contentsensitiveword', 'LogList', '', 2, 0, '', UNIX_TIMESTAMP(), 0);

-- 将权限分配给超级管理员角色（role_id=1）
INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 780, UNIX_TIMESTAMP()),
(1, 781, UNIX_TIMESTAMP()),
(1, 782, UNIX_TIMESTAMP()),
(1, 783, UNIX_TIMESTAMP());
