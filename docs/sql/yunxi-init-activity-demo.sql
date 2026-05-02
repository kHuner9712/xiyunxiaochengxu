-- ============================================================
-- 禧孕小程序 — 活动演示数据初始化
-- ============================================================
--
-- 【用途】
--   插入最小可用活动样例数据到 sxo_activity 表
--   确保首页推荐活动区块和活动列表页不为空
--
-- 【执行时机】
--   在 muying-final-migration.sql 之后执行
--   如果已有活动数据，不会冲突（使用 AUTO_INCREMENT）
--
-- 【环境说明】
--   - 演示环境：可直接执行
--   - 正式环境：可直接执行作为初始内容，后续在后台管理中增删改
--   - 正式环境请将 {{CONTACT_PHONE}} 替换为实际客服电话
--
-- 【表前缀】
--   默认 sxo_，如不同请全局替换
--
-- 【阶段覆盖】
--   prepare / pregnancy / postpartum / all 四种阶段均已覆盖
--
-- 【字段说明】
--   本 SQL 严格对齐 muying-final-migration.sql 中 A1 段建表语句
--   以及 ActivityService.php 中实际读写的字段
--
-- 【回滚】
--   DELETE FROM sxo_activity WHERE title IN (
--     '孕期营养课堂', '产后修复沙龙', '备孕优生课堂',
--     '新生儿护理讲座', '孕妈试用官招募', '母婴好物签到打卡'
--   );
-- ============================================================

INSERT INTO `sxo_activity` (
    `title`,
    `cover`,
    `images`,
    `category`,
    `stage`,
    `description`,
    `content`,
    `suitable_crowd`,
    `address`,
    `start_time`,
    `end_time`,
    `signup_start_time`,
    `signup_end_time`,
    `max_count`,
    `signup_count`,
    `is_free`,
    `price`,
    `contact_name`,
    `contact_phone`,
    `access_count`,
    `sort_level`,
    `is_enable`,
    `is_delete_time`,
    `add_time`,
    `upd_time`
) VALUES

-- 1. 孕期阶段 · 课堂类 · 免费
(
    '孕期营养课堂',
    '',
    NULL,
    'classroom',
    'pregnancy',
    '专业营养师讲解孕期饮食搭配，科学补充关键营养素',
    '<p>课程内容：</p><ul><li>孕期各阶段营养需求变化</li><li>叶酸、铁、钙等关键营养素补充指南</li><li>孕期饮食禁忌与误区</li><li>体重管理：长胎不长肉</li></ul><p>适合孕12周以上的准妈妈参加。</p>',
    '孕12周以上准妈妈',
    '线上直播',
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 30,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 25,
    50,
    0,
    1,
    0.00,
    '禧孕客服',
    '{{CONTACT_PHONE}}',
    0,
    100,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 2. 产后阶段 · 沙龙类 · 免费
(
    '产后修复沙龙',
    '',
    NULL,
    'salon',
    'postpartum',
    '产后身体恢复指导，盆底肌修复与身材管理',
    '<p>沙龙内容：</p><ul><li>产后42天复查解读</li><li>盆底肌康复训练实操</li><li>腹直肌分离自测与修复</li><li>产后情绪管理</li></ul><p>名额有限，先到先得。</p>',
    '产后6个月内妈妈',
    '禧孕体验中心（北京市朝阳区XX路XX号）',
    UNIX_TIMESTAMP() + 86400 * 3,
    UNIX_TIMESTAMP() + 86400 * 33,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 28,
    20,
    0,
    1,
    0.00,
    '禧孕客服',
    '{{CONTACT_PHONE}}',
    0,
    90,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 3. 备孕阶段 · 课堂类 · 免费
(
    '备孕优生课堂',
    '',
    NULL,
    'classroom',
    'prepare',
    '备孕注意事项与优生优育知识，科学备孕从现在开始',
    '<p>课程内容：</p><ul><li>备孕检查项目全攻略</li><li>叶酸怎么吃？什么时候开始？</li><li>排卵期计算与同房时机</li><li>男性备孕注意事项</li></ul><p>适合计划6个月内怀孕的夫妻。</p>',
    '计划6个月内怀孕的夫妻',
    '线上直播',
    UNIX_TIMESTAMP() + 86400 * 5,
    UNIX_TIMESTAMP() + 86400 * 35,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 30,
    100,
    0,
    1,
    0.00,
    '禧孕客服',
    '{{CONTACT_PHONE}}',
    0,
    80,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 4. 产后阶段 · 讲座类 · 免费
(
    '新生儿护理讲座',
    '',
    NULL,
    'lecture',
    'postpartum',
    '新生儿日常护理要点，新手爸妈必修课',
    '<p>讲座内容：</p><ul><li>新生儿洗澡与脐带护理</li><li>母乳喂养姿势与技巧</li><li>新生儿黄疸观察与应对</li><li>婴儿睡眠安全指南</li></ul>',
    '新手爸妈',
    '线上直播',
    UNIX_TIMESTAMP() + 86400 * 7,
    UNIX_TIMESTAMP() + 86400 * 37,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 32,
    80,
    0,
    1,
    0.00,
    '禧孕客服',
    '{{CONTACT_PHONE}}',
    0,
    70,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 5. 孕期阶段 · 试用官类 · 免费
(
    '孕妈试用官招募',
    '',
    NULL,
    'trial',
    'pregnancy',
    '成为禧孕试用官，免费体验母婴好物并分享真实感受',
    '<p>试用官权益：</p><ul><li>免费获得试用产品</li><li>专属试用官社群交流</li><li>优质测评可获积分奖励</li></ul><p>要求：收到产品后7天内提交真实使用感受。</p>',
    '孕期准妈妈',
    '线上',
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 60,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 55,
    30,
    0,
    1,
    0.00,
    '禧孕客服',
    '{{CONTACT_PHONE}}',
    0,
    60,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
),

-- 6. 通用阶段 · 签到类 · 免费
(
    '母婴好物签到打卡',
    '',
    NULL,
    'checkin',
    'all',
    '每日签到领积分，连续签到奖励翻倍',
    '<p>签到规则：</p><ul><li>每日签到获得5积分</li><li>连续7天签到额外奖励30积分</li><li>连续30天签到额外奖励200积分</li></ul>',
    '所有用户',
    '线上',
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 90,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP() + 86400 * 85,
    0,
    0,
    1,
    0.00,
    '禧孕客服',
    '{{CONTACT_PHONE}}',
    0,
    50,
    1,
    0,
    UNIX_TIMESTAMP(),
    UNIX_TIMESTAMP()
);

-- ============================================================
-- 执行后验证
-- ============================================================
-- 1. 检查活动总数
-- SELECT COUNT(*) AS activity_count FROM sxo_activity WHERE is_enable=1 AND is_delete_time=0;
-- 预期：6
--
-- 2. 检查阶段覆盖
-- SELECT stage, COUNT(*) AS cnt FROM sxo_activity WHERE is_enable=1 AND is_delete_time=0 GROUP BY stage;
-- 预期：prepare=1, pregnancy=2, postpartum=2, all=1
--
-- 3. 检查分类覆盖
-- SELECT category, COUNT(*) AS cnt FROM sxo_activity WHERE is_enable=1 AND is_delete_time=0 GROUP BY category;
-- 预期：classroom=2, salon=1, lecture=1, trial=1, checkin=1
--
-- 4. 检查时间有效性（活动应未过期）
-- SELECT id, title, FROM_UNIXTIME(end_time) AS end_date FROM sxo_activity WHERE is_enable=1 AND is_delete_time=0 AND end_time < UNIX_TIMESTAMP();
-- 预期：0 行（无过期活动）
