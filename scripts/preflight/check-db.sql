-- ============================================================
-- 禧孕小程序 — 上线前数据库结构预检
-- ============================================================
--
-- 【用途】在 MySQL 中执行，自动检查上线所需数据库条件
-- 【用法】mysql -u {DB_USER} -p {DB_NAME} < check-db.sql
-- 【输出】每行显示检查项 + 结果状态
-- 【注意】本脚本只做 SELECT 查询，不修改任何数据
--
-- 【表前缀】
--   默认 sxo_，如不同请全局替换
-- ============================================================

SELECT '========================================' AS '';
SELECT ' 禧孕上线前数据库预检' AS '';
SELECT '========================================' AS '';

-- ============================================================
-- 1. 必需表检查
-- ============================================================
SELECT '' AS '';
SELECT '--- 1. 必需表检查 ---' AS '';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN CONCAT('PASS: 表 ', table_name, ' 存在')
        ELSE CONCAT('FAIL: 表 ', table_name, ' 缺失 | 修复: 执行 muying-final-migration.sql A 段')
    END AS result
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN (
    'sxo_activity',
    'sxo_activity_signup',
    'sxo_invite_reward',
    'sxo_muying_feedback',
    'sxo_user',
    'sxo_goods_favor',
    'sxo_config'
)
GROUP BY table_name;

-- 检查是否有缺失的表
SELECT
    CASE
        WHEN missing_count = 0 THEN 'PASS: 所有必需表均存在'
        ELSE CONCAT('FAIL: 缺少 ', missing_count, ' 张必需表 | 修复: 执行 muying-final-migration.sql A 段')
    END AS result
FROM (
    SELECT 7 - COUNT(*) AS missing_count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (
        'sxo_activity',
        'sxo_activity_signup',
        'sxo_invite_reward',
        'sxo_muying_feedback',
        'sxo_user',
        'sxo_goods_favor',
        'sxo_config'
    )
) t;

-- ============================================================
-- 2. 关键字段检查
-- ============================================================
SELECT '' AS '';
SELECT '--- 2. 关键字段检查 ---' AS '';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN CONCAT('PASS: 字段 ', table_name, '.', column_name, ' 存在')
        ELSE CONCAT('FAIL: 字段 ', table_name, '.', column_name, ' 缺失 | 修复: 执行 muying-final-migration.sql B 段')
    END AS result
FROM (
    SELECT 'sxo_activity_signup' AS table_name, 'privacy_agreed_time' AS column_name
    UNION ALL SELECT 'sxo_goods_favor', 'type'
    UNION ALL SELECT 'sxo_user', 'current_stage'
    UNION ALL SELECT 'sxo_user', 'due_date'
    UNION ALL SELECT 'sxo_user', 'baby_birthday'
    UNION ALL SELECT 'sxo_user', 'invite_code'
    UNION ALL SELECT 'sxo_activity', 'suitable_crowd'
    UNION ALL SELECT 'sxo_activity', 'stage'
    UNION ALL SELECT 'sxo_activity', 'category'
    UNION ALL SELECT 'sxo_muying_feedback', 'review_status'
    UNION ALL SELECT 'sxo_muying_feedback', 'review_remark'
    UNION ALL SELECT 'sxo_muying_feedback', 'review_admin_id'
    UNION ALL SELECT 'sxo_muying_feedback', 'review_time'
) expected
LEFT JOIN information_schema.COLUMNS ic
    ON ic.TABLE_SCHEMA = DATABASE()
    AND ic.TABLE_NAME = expected.table_name
    AND ic.COLUMN_NAME = expected.column_name
GROUP BY expected.table_name, expected.column_name;

-- 汇总缺失字段数
SELECT
    CASE
        WHEN missing_count = 0 THEN 'PASS: 所有关键字段均存在'
        ELSE CONCAT('FAIL: 缺少 ', missing_count, ' 个关键字段 | 修复: 执行 muying-final-migration.sql B 段 或 muying-feedback-review-migration.sql')
    END AS result
FROM (
    SELECT 13 - COUNT(*) AS missing_count
    FROM (
        SELECT 'sxo_activity_signup' AS table_name, 'privacy_agreed_time' AS column_name
        UNION ALL SELECT 'sxo_goods_favor', 'type'
        UNION ALL SELECT 'sxo_user', 'current_stage'
        UNION ALL SELECT 'sxo_user', 'due_date'
        UNION ALL SELECT 'sxo_user', 'baby_birthday'
        UNION ALL SELECT 'sxo_user', 'invite_code'
        UNION ALL SELECT 'sxo_activity', 'suitable_crowd'
        UNION ALL SELECT 'sxo_activity', 'stage'
        UNION ALL SELECT 'sxo_activity', 'category'
        UNION ALL SELECT 'sxo_muying_feedback', 'review_status'
        UNION ALL SELECT 'sxo_muying_feedback', 'review_remark'
        UNION ALL SELECT 'sxo_muying_feedback', 'review_admin_id'
        UNION ALL SELECT 'sxo_muying_feedback', 'review_time'
    ) expected
    INNER JOIN information_schema.COLUMNS ic
        ON ic.TABLE_SCHEMA = DATABASE()
        AND ic.TABLE_NAME = expected.table_name
        AND ic.COLUMN_NAME = expected.column_name
) t;

-- ============================================================
-- 3. 关键索引检查
-- ============================================================
SELECT '' AS '';
SELECT '--- 3. 关键索引检查 ---' AS '';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN CONCAT('PASS: 索引 ', index_name, ' 存在于 ', table_name)
        ELSE CONCAT('FAIL: 索引 ', index_name, ' 缺失于 ', table_name, ' | 修复: 执行 muying-final-migration.sql C2/C3 段')
    END AS result
FROM (
    SELECT 'sxo_user' AS table_name, 'uk_invite_code' AS index_name
    UNION ALL SELECT 'sxo_invite_reward', 'uk_inviter_invitee_event'
) expected
LEFT JOIN information_schema.STATISTICS ic
    ON ic.TABLE_SCHEMA = DATABASE()
    AND ic.TABLE_NAME = expected.table_name
    AND ic.INDEX_NAME = expected.index_name
GROUP BY expected.table_name, expected.index_name;

-- ============================================================
-- 4. 配置项检查
-- ============================================================
SELECT '' AS '';
SELECT '--- 4. 配置项检查 ---' AS '';

SELECT
    CASE
        WHEN c.value IS NOT NULL AND c.value != '' THEN CONCAT('PASS: ', c.only_tag, ' = ', c.value)
        WHEN c.value = '' THEN CONCAT('WARN: ', c.only_tag, ' 存在但值为空 | 修复: 在后台设置有效值')
        ELSE CONCAT('FAIL: ', expected.only_tag, ' 缺失 | 修复: 执行 xiyun-init-config.sql')
    END AS result
FROM (
    SELECT 'muying_invite_register_reward' AS only_tag
    UNION ALL SELECT 'muying_invite_first_order_reward'
    UNION ALL SELECT 'home_site_name'
    UNION ALL SELECT 'common_app_is_weixin_force_user_base'
    UNION ALL SELECT 'common_user_is_mandatory_bind_mobile'
    UNION ALL SELECT 'home_search_keywords'
) expected
LEFT JOIN sxo_config c ON c.only_tag = expected.only_tag;

-- ============================================================
-- 5. 数据完整性检查
-- ============================================================
SELECT '' AS '';
SELECT '--- 5. 数据完整性检查 ---' AS '';

-- 邀请码空值
SELECT
    CASE
        WHEN empty_count = 0 THEN 'PASS: 所有用户均有邀请码'
        ELSE CONCAT('WARN: ', empty_count, ' 个用户邀请码为空 | 修复: 执行 muying-final-migration.sql C1 段')
    END AS result
FROM (SELECT COUNT(*) AS empty_count FROM sxo_user WHERE invite_code = '' OR invite_code IS NULL) t;

-- 邀请奖励重复
SELECT
    CASE
        WHEN dup_count = 0 THEN 'PASS: 无重复邀请奖励记录'
        ELSE CONCAT('WARN: ', dup_count, ' 组重复邀请奖励 | 修复: 执行 muying-final-migration.sql C3 段')
    END AS result
FROM (
    SELECT COUNT(*) AS dup_count FROM (
        SELECT inviter_id, invitee_id, trigger_event, COUNT(*) AS cnt
        FROM sxo_invite_reward
        GROUP BY inviter_id, invitee_id, trigger_event
        HAVING cnt > 1
    ) dup
) t;

-- 活动数据
SELECT
    CASE
        WHEN act_count > 0 THEN CONCAT('PASS: 活动数据 ', act_count, ' 条')
        ELSE 'WARN: 无活动数据 | 建议: 执行 xiyun-init-activity-demo.sql 或在后台添加'
    END AS result
FROM (SELECT COUNT(*) AS act_count FROM sxo_activity WHERE is_enable = 1 AND is_delete_time = 0) t;

-- 妈妈说数据
SELECT
    CASE
        WHEN fb_count > 0 THEN CONCAT('PASS: 妈妈说数据 ', fb_count, ' 条')
        ELSE 'WARN: 无妈妈说数据 | 建议: 执行 xiyun-init-feedback-demo.sql 或在后台添加'
    END AS result
FROM (SELECT COUNT(*) AS fb_count FROM sxo_muying_feedback WHERE is_enable = 1 AND is_delete_time = 0) t;

-- ============================================================
-- 6. 阶段筛选关键词命中检查
-- ============================================================
SELECT '' AS '';
SELECT '--- 6. 商品分类阶段关键词命中检查 ---' AS '';

SELECT
    CASE
        WHEN cnt > 0 THEN CONCAT('PASS: 备孕阶段命中 ', cnt, ' 个分类')
        ELSE 'FAIL: 备孕阶段无命中分类 | 修复: 创建含"备孕"或"孕前"关键词的一级分类'
    END AS result
FROM (SELECT COUNT(*) AS cnt FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%备孕%' OR name LIKE '%孕前%')) t;

SELECT
    CASE
        WHEN cnt > 0 THEN CONCAT('PASS: 孕期阶段命中 ', cnt, ' 个分类')
        ELSE 'FAIL: 孕期阶段无命中分类 | 修复: 创建含"孕期"或"孕妇"关键词的一级分类'
    END AS result
FROM (SELECT COUNT(*) AS cnt FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%孕期%' OR name LIKE '%孕妇%' OR name LIKE '%孕中%' OR name LIKE '%孕妈%' OR name LIKE '%怀孕%')) t;

SELECT
    CASE
        WHEN cnt > 0 THEN CONCAT('PASS: 产后阶段命中 ', cnt, ' 个分类')
        ELSE 'FAIL: 产后阶段无命中分类 | 修复: 创建含"产后"或"月子"关键词的一级分类'
    END AS result
FROM (SELECT COUNT(*) AS cnt FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%产后%' OR name LIKE '%月子%' OR name LIKE '%哺乳%' OR name LIKE '%新生儿%' OR name LIKE '%婴儿%' OR name LIKE '%宝宝%')) t;

-- ============================================================
-- 汇总
-- ============================================================
SELECT '' AS '';
SELECT '========================================' AS '';
SELECT ' 预检完成，请检查上方 FAIL 和 WARN 项' AS '';
SELECT ' FAIL = 必须修复才能上线' AS '';
SELECT ' WARN = 建议修复，不阻断上线' AS '';
SELECT '========================================' AS '';
