-- ============================================================
-- 禧孕小程序 — 自定义配置项初始化
-- ============================================================
--
-- 【用途】
--   插入母婴业务所需的自定义配置项到 sxo_config 表
--   这些配置项是邀请奖励、首页展示等功能的必要前提
--
-- 【执行时机】
--   在 muying-final-migration.sql 之后执行
--   所有 INSERT 均使用 ON DUPLICATE KEY UPDATE，可重复执行不报错
--
-- 【环境说明】
--   - 演示环境：可直接执行
--   - 正式环境：可直接执行，后续在后台"系统设置"中调整 value 即可
--
-- 【表前缀】
--   默认 sxo_，如不同请全局替换
--
-- 【回滚】
--   DELETE FROM sxo_config WHERE only_tag LIKE 'muying_%';
-- ============================================================

-- -----------------------------------------------------------
-- 1. 邀请奖励配置（必须！缺失则邀请奖励=0，严重伤害用户信任）
-- -----------------------------------------------------------

-- 邀请注册奖励积分
-- 默认值 100：被邀请人注册成功后，邀请人获得 100 积分
-- 后台修改路径：系统设置 → 搜索 only_tag = muying_invite_register_reward
-- 后端读取：InviteService.php → MyC('muying_invite_register_reward', 0, true)
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('100', '邀请注册奖励积分', '邀请人获得的积分奖励', '请填写邀请注册奖励积分', 'common', 'muying_invite_register_reward', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `upd_time`=UNIX_TIMESTAMP();

-- 邀请首单奖励积分
-- 默认值 200：被邀请人完成首单后，邀请人额外获得 200 积分
-- 后台修改路径：系统设置 → 搜索 only_tag = muying_invite_first_order_reward
-- 后端读取：InviteService.php → MyC('muying_invite_first_order_reward', 0, true)
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('200', '邀请首单奖励积分', '被邀请人首单后邀请人获得的积分奖励', '请填写邀请首单奖励积分', 'common', 'muying_invite_first_order_reward', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `upd_time`=UNIX_TIMESTAMP();

-- -----------------------------------------------------------
-- 2. 首页品牌配置（建议执行，缺失则使用 ShopXO 默认值）
-- -----------------------------------------------------------

-- 站点名称
-- 默认值 '禧孕'：显示在登录页标题、分享标题等位置
-- 后台修改路径：系统设置 → 站点设置 → 站点名称
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('禧孕', '站点名称', '站点名称，显示在浏览器标题和分享卡片', '', 'home', 'home_site_name', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`='禧孕', `upd_time`=UNIX_TIMESTAMP();

-- 正方形 Logo（登录页头像、分享图标）
-- 建议尺寸：300x300px，PNG 格式
-- 需要先上传图片到服务器，再填写路径
-- 后台修改路径：系统设置 → 站点设置 → 正方形logo
-- INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
-- ('/static/upload/images/logo/xiyun-square.png', '正方形logo', '建议300x300px，png格式', '', 'home', 'home_site_logo_square', UNIX_TIMESTAMP())
-- ON DUPLICATE KEY UPDATE `value`='/static/upload/images/logo/xiyun-square.png', `upd_time`=UNIX_TIMESTAMP();

-- 手机端 Logo
-- 建议尺寸：220x66px
-- INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
-- ('/static/upload/images/logo/xiyun-wap.png', '手机端logo', '建议220x66px', '', 'home', 'home_site_logo_wap', UNIX_TIMESTAMP())
-- ON DUPLICATE KEY UPDATE `value`='/static/upload/images/logo/xiyun-wap.png', `upd_time`=UNIX_TIMESTAMP();

-- -----------------------------------------------------------
-- 3. 微信小程序登录配置（建议执行）
-- -----------------------------------------------------------

-- 是否强制填写基础信息
-- 默认值 0：不强制，用户可用默认昵称进入系统
-- 设为 1：登录后弹出 user-base 组件要求填写头像/昵称/手机号
-- 建议上线初期设为 0，降低登录门槛
-- 后台修改路径：系统设置 → 搜索 only_tag = common_app_is_weixin_force_user_base
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('0', '微信小程序强制填写基础信息', '0=不强制，1=登录后强制弹窗填写头像昵称手机号', '', 'common', 'common_app_is_weixin_force_user_base', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`='0', `upd_time`=UNIX_TIMESTAMP();

-- 是否强制绑定手机号
-- 默认值 1：强制绑定，用户必须绑定手机号才能使用核心功能
-- 设为 0：不强制绑定
-- 建议保持 1，手机号是关键身份链路
-- 后台修改路径：系统设置 → 搜索 only_tag = common_user_is_mandatory_bind_mobile
-- 注意：此配置项通常在 ShopXO 安装时已存在，以下用 ON DUPLICATE KEY UPDATE 确保值正确
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('1', '是否强制绑定手机号', '0=不强制，1=强制绑定', '', 'common', 'common_user_is_mandatory_bind_mobile', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`='1', `upd_time`=UNIX_TIMESTAMP();

-- -----------------------------------------------------------
-- 4. 搜索关键词配置（建议执行，提升首页体验）
-- -----------------------------------------------------------

-- 首页搜索热门关键词
-- 默认值：母婴相关的热门搜索词
-- 后台修改路径：系统设置 → 搜索设置 → 搜索关键字
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('叶酸,孕妇装,月子餐,婴儿推车,产后修复', '搜索关键字', '首页搜索框热门关键词，英文逗号分隔', '', 'home', 'home_search_keywords', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`='叶酸,孕妇装,月子餐,婴儿推车,产后修复', `upd_time`=UNIX_TIMESTAMP();

-- 搜索关键字类型
-- 2=自定义（使用上面配置的关键字）
-- 后台修改路径：系统设置 → 搜索设置 → 搜索关键字类型
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('2', '搜索关键字类型', '1=热门搜索，2=自定义', '', 'home', 'home_search_keywords_type', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`='2', `upd_time`=UNIX_TIMESTAMP();

-- ============================================================
-- 执行后验证
-- ============================================================
-- SELECT only_tag, value, name FROM sxo_config WHERE only_tag LIKE 'muying_%' OR only_tag IN ('home_site_name', 'common_app_is_weixin_force_user_base', 'common_user_is_mandatory_bind_mobile', 'home_search_keywords', 'home_search_keywords_type');
-- 预期：至少 7 行结果
