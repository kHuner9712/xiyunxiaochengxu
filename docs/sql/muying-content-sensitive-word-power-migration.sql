-- ============================================================
-- 禧孕一期：内容合规敏感词管理 - 后台权限菜单注册迁移
-- 幂等性：使用 INSERT IGNORE，可重复执行
-- 兼容：MySQL 5.7.44+
-- 权限 ID 范围：793-796（避免与 muying-final-migration.sql 770-782 冲突）
-- ============================================================

-- 内容合规管理（二级菜单，挂在禧孕运营 700 下，sort=11）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(793, 700, '内容合规', 'Contentsensitiveword', 'Index', '', 11, 1, '', UNIX_TIMESTAMP(), 0),
(794, 793, '添加敏感词', 'Contentsensitiveword', 'Save', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(795, 793, '删除敏感词', 'Contentsensitiveword', 'Delete', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(796, 793, '查看合规日志', 'Contentsensitiveword', 'LogList', '', 2, 0, '', UNIX_TIMESTAMP(), 0);

-- 将权限分配给超级管理员角色（role_id=1）
INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 793, UNIX_TIMESTAMP()),
(1, 794, UNIX_TIMESTAMP()),
(1, 795, UNIX_TIMESTAMP()),
(1, 796, UNIX_TIMESTAMP());
