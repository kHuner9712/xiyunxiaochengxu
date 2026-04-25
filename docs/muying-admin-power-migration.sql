-- ============================================================
-- 孕禧一期：后台权限菜单注册迁移
-- 将 Activity/Activitysignup/Invite/Inviteconfig/Feedback/Featureswitch
-- 注册到 sxo_power 表和 sxo_role_power 表，使后台左侧菜单可见可操作
-- 幂等性：使用 INSERT IGNORE，可重复执行
-- 兼容：MySQL 5.7.44+
-- ============================================================

-- 1. 一级菜单：孕禧运营（sort=15，排在"仓库"之后"手机"之前）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(700, 0, '孕禧运营', 'Muying', 'Index', '', 15, 1, 'icon-admin-article', UNIX_TIMESTAMP(), 0);

-- 2. 活动管理（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(701, 700, '活动管理', 'Activity', 'Index', '', 1, 1, '', UNIX_TIMESTAMP(), 0),
(702, 701, '活动详情', 'Activity', 'Detail', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(703, 701, '活动添加/编辑页面', 'Activity', 'SaveInfo', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(704, 701, '活动添加/编辑', 'Activity', 'Save', '', 2, 0, '', UNIX_TIMESTAMP(), 0),
(705, 701, '活动状态更新', 'Activity', 'StatusUpdate', '', 3, 0, '', UNIX_TIMESTAMP(), 0),
(706, 701, '活动删除', 'Activity', 'Delete', '', 4, 0, '', UNIX_TIMESTAMP(), 0);

-- 3. 活动报名管理（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(710, 700, '活动报名', 'Activitysignup', 'Index', '', 2, 1, '', UNIX_TIMESTAMP(), 0),
(711, 710, '报名详情', 'Activitysignup', 'Detail', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(712, 710, '签到核销', 'Activitysignup', 'Checkin', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(713, 710, '确认报名', 'Activitysignup', 'Confirm', '', 2, 0, '', UNIX_TIMESTAMP(), 0),
(714, 710, '报名删除', 'Activitysignup', 'Delete', '', 3, 0, '', UNIX_TIMESTAMP(), 0),
(715, 710, '报名导出', 'Activitysignup', 'Export', '', 4, 0, '', UNIX_TIMESTAMP(), 0);

-- 4. 邀请奖励管理（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(720, 700, '邀请奖励', 'Invite', 'Index', '', 3, 1, '', UNIX_TIMESTAMP(), 0),
(721, 720, '奖励详情', 'Invite', 'Detail', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(722, 720, '奖励补发', 'Invite', 'Grant', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(723, 720, '奖励撤销', 'Invite', 'Cancel', '', 2, 0, '', UNIX_TIMESTAMP(), 0);

-- 5. 邀请配置（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(730, 700, '邀请配置', 'Inviteconfig', 'Index', '', 4, 1, '', UNIX_TIMESTAMP(), 0),
(731, 730, '邀请配置保存', 'Inviteconfig', 'Save', '', 0, 0, '', UNIX_TIMESTAMP(), 0);

-- 6. 用户反馈管理（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(740, 700, '用户反馈', 'Feedback', 'Index', '', 5, 1, '', UNIX_TIMESTAMP(), 0),
(741, 740, '反馈详情', 'Feedback', 'Detail', '', 0, 0, '', UNIX_TIMESTAMP(), 0),
(742, 740, '反馈审核', 'Feedback', 'Review', '', 1, 0, '', UNIX_TIMESTAMP(), 0),
(743, 740, '反馈状态更新', 'Feedback', 'StatusUpdate', '', 2, 0, '', UNIX_TIMESTAMP(), 0),
(744, 740, '反馈删除', 'Feedback', 'Delete', '', 3, 0, '', UNIX_TIMESTAMP(), 0);

-- 7. 功能开关（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(750, 700, '功能开关', 'Featureswitch', 'Index', '', 6, 1, '', UNIX_TIMESTAMP(), 0),
(751, 750, '功能开关保存', 'Featureswitch', 'Save', '', 0, 0, '', UNIX_TIMESTAMP(), 0);

-- 8. 孕禧数据看板（二级菜单）
INSERT IGNORE INTO `sxo_power` (`id`, `pid`, `name`, `control`, `action`, `url`, `sort`, `is_show`, `icon`, `add_time`, `upd_time`) VALUES
(760, 700, '孕禧数据看板', 'Muyingstat', 'Index', '', 7, 1, '', UNIX_TIMESTAMP(), 0);

-- 9. 将所有新权限分配给超级管理员角色（role_id=1）
INSERT IGNORE INTO `sxo_role_power` (`role_id`, `power_id`, `add_time`) VALUES
(1, 700, UNIX_TIMESTAMP()),
(1, 701, UNIX_TIMESTAMP()), (1, 702, UNIX_TIMESTAMP()), (1, 703, UNIX_TIMESTAMP()),
(1, 704, UNIX_TIMESTAMP()), (1, 705, UNIX_TIMESTAMP()), (1, 706, UNIX_TIMESTAMP()),
(1, 710, UNIX_TIMESTAMP()), (1, 711, UNIX_TIMESTAMP()), (1, 712, UNIX_TIMESTAMP()),
(1, 713, UNIX_TIMESTAMP()), (1, 714, UNIX_TIMESTAMP()), (1, 715, UNIX_TIMESTAMP()),
(1, 720, UNIX_TIMESTAMP()), (1, 721, UNIX_TIMESTAMP()), (1, 722, UNIX_TIMESTAMP()),
(1, 723, UNIX_TIMESTAMP()),
(1, 730, UNIX_TIMESTAMP()), (1, 731, UNIX_TIMESTAMP()),
(1, 740, UNIX_TIMESTAMP()), (1, 741, UNIX_TIMESTAMP()), (1, 742, UNIX_TIMESTAMP()),
(1, 743, UNIX_TIMESTAMP()), (1, 744, UNIX_TIMESTAMP()),
(1, 750, UNIX_TIMESTAMP()), (1, 751, UNIX_TIMESTAMP()),
(1, 760, UNIX_TIMESTAMP());

-- 10. 更新隐私弹窗文案
UPDATE `sxo_config` SET `value` = '为了向您提供活动签到、收货地址选择等服务，我们需要获取您的位置信息；为了更换头像或上传反馈图片，我们需要访问您的相册或摄像头。您可以拒绝授权，不影响其他功能使用。' WHERE `only_tag` = 'common_app_mini_weixin_privacy_content';
