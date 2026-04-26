-- ============================================================
-- 孕禧一期：隐私数据管理 - 后台权限菜单注册迁移
-- 将 Muyingprivacy 控制器注册到 sxo_power 表
-- 幂等性：使用 INSERT IGNORE，可重复执行
-- 兼容：MySQL 5.7.44+
-- 权限 ID 范围：790-792（避免与 muying-final-migration.sql 770-782 冲突）
-- ============================================================

-- 1. 隐私数据管理（二级菜单，挂在孕禧运营 700 下，sort=10）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(790, 700, '隐私数据管理', 'Muyingprivacy', 'Index', '', 10, 1, '', UNIX_TIMESTAMP(), 0),
(791, 790, '用户数据查询', 'Muyingprivacy', 'Search', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(792, 790, '数据匿名化', 'Muyingprivacy', 'Anonymize', '', 1, 0, '', UNIX_TIMESTAMP(), 0);

-- 2. 将权限分配给超级管理员角色（role_id=1）
INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 790, UNIX_TIMESTAMP()),
(1, 791, UNIX_TIMESTAMP()),
(1, 792, UNIX_TIMESTAMP());
