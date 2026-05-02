-- ============================================================
-- 禧孕小程序 — 妈妈说反馈演示数据初始化
-- ============================================================
--
-- 【用途】
--   插入最小"妈妈说"示例数据到 sxo_muying_feedback 表
--   确保首页反馈区块不为空
--
-- 【执行时机】
--   在 muying-final-migration.sql 之后执行
--   如果已有反馈数据，不会冲突（使用 AUTO_INCREMENT）
--
-- 【环境说明】
--   - 演示环境：可直接执行
--   - 正式环境：可直接执行作为初始内容，后续在后台管理中增删改
--   - 正式运营后建议替换为真实用户反馈
--
-- 【表前缀】
--   默认 sxo_，如不同请全局替换
--
-- 【字段说明】
--   本 SQL 严格对齐 muying-final-migration.sql 中 A3 段建表语句
--   以及 FeedbackService.php 中实际读写的字段
--
-- 【回滚】
--   DELETE FROM sxo_muying_feedback WHERE user_id = 0 AND nickname IN (
--     '小雨妈妈', '糖糖妈', '备孕中的小鹿', '果果妈', '新手奶爸'
--   );
-- ============================================================

INSERT INTO `sxo_muying_feedback` (
    `user_id`,
    `nickname`,
    `avatar`,
    `content`,
    `stage`,
    `sort_level`,
    `is_enable`,
    `is_delete_time`,
    `add_time`,
    `upd_time`
) VALUES

-- 1. 孕期阶段
(
    0,
    '小雨妈妈',
    '',
    '孕晚期每天坚持散步，顺产恢复特别快，姐妹们加油！',
    'pregnancy',
    100,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 2. 产后阶段
(
    0,
    '糖糖妈',
    '',
    '产后修复真的不能偷懒，出了月子就开始做凯格尔运动，效果很明显',
    'postpartum',
    90,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 3. 备孕阶段
(
    0,
    '备孕中的小鹿',
    '',
    '开始吃叶酸了，调整作息，期待好孕到来~',
    'prepare',
    80,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 4. 孕期阶段（补充）
(
    0,
    '果果妈',
    '',
    '孕中期开始用托腹带，腰酸缓解了不少，推荐给同样腰疼的孕妈',
    'pregnancy',
    70,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 5. 产后阶段（补充）
(
    0,
    '新手奶爸',
    '',
    '陪老婆产检学到很多，准爸爸们一定要多参与，别让妈妈一个人扛',
    'postpartum',
    60,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
);

-- ============================================================
-- 执行后验证
-- ============================================================
-- 1. 检查反馈总数
-- SELECT COUNT(*) AS feedback_count FROM sxo_muying_feedback WHERE is_enable=1 AND is_delete_time=0;
-- 预期：5
--
-- 2. 检查阶段覆盖
-- SELECT stage, COUNT(*) AS cnt FROM sxo_muying_feedback WHERE is_enable=1 AND is_delete_time=0 GROUP BY stage;
-- 预期：prepare=1, pregnancy=2, postpartum=2
--
-- 3. 检查首页展示排序
-- SELECT nickname, content, stage, sort_level FROM sxo_muying_feedback WHERE is_enable=1 AND is_delete_time=0 ORDER BY sort_level DESC;
-- 预期：5 行，按 sort_level 降序
