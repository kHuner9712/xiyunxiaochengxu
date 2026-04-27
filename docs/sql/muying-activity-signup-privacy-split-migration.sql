-- ============================================================
-- 活动报名隐私授权拆分迁移脚本
-- 日期：2026-04-27（v2 前缀安全 + 幂等 + 历史数据谨慎策略）
-- 说明：在 sxo_activity_signup 表增加 profile_sync_agreed 和 profile_sync_agreed_time 字段
--
-- 【表前缀】
--   本脚本默认使用 sxo_ 前缀，与 ShopXO 安装默认一致。
--   如果你的数据库 PREFIX 不是 sxo_，请先全局替换本文件中的 sxo_ 为你的实际前缀。
--   查看方式：后台 → 系统设置 → 数据库配置 → 表前缀
--            或查看 shopxo-backend/.env 中 DATABASE.PREFIX
--
-- 【幂等性】
--   使用 information_schema.COLUMNS 判断字段是否已存在，可重复执行。
--   不依赖 ADD COLUMN IF NOT EXISTS（该语法仅 MySQL 8.0+ 支持）。
--
-- 【MySQL 版本】
--   兼容 MySQL 5.7.44+（宝塔面板默认）
--
-- 【执行时机】
--   在 muying-final-migration.sql 之后执行
--
-- 【回滚】
--   ALTER TABLE `sxo_activity_signup` DROP COLUMN `profile_sync_agreed_time`;
--   ALTER TABLE `sxo_activity_signup` DROP COLUMN `profile_sync_agreed`;
-- ============================================================

-- ============================================================
-- 一、新增字段（幂等：字段已存在则跳过）
-- ============================================================

SET @col_exists_1 = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sxo_activity_signup'
      AND COLUMN_NAME = 'profile_sync_agreed'
);

SET @sql_1 = IF(@col_exists_1 = 0,
    'ALTER TABLE `sxo_activity_signup` ADD COLUMN `profile_sync_agreed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''画像同步授权 0=未同意 1=已同意'' AFTER `privacy_version`',
    'SELECT ''[SKIP] profile_sync_agreed already exists in sxo_activity_signup'''
);
PREPARE stmt_1 FROM @sql_1;
EXECUTE stmt_1;
DEALLOCATE PREPARE stmt_1;

SET @col_exists_2 = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sxo_activity_signup'
      AND COLUMN_NAME = 'profile_sync_agreed_time'
);

SET @sql_2 = IF(@col_exists_2 = 0,
    'ALTER TABLE `sxo_activity_signup` ADD COLUMN `profile_sync_agreed_time` INT(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT ''画像同步授权时间'' AFTER `profile_sync_agreed`',
    'SELECT ''[SKIP] profile_sync_agreed_time already exists in sxo_activity_signup'''
);
PREPARE stmt_2 FROM @sql_2;
EXECUTE stmt_2;
DEALLOCATE PREPARE stmt_2;

-- ============================================================
-- 二、历史数据处理（可选 — 人工确认后执行）
--
-- 旧逻辑中 privacy_agreed_time > 0 的记录，是否实际同步过画像不一定可追溯。
-- 因此默认 profile_sync_agreed = 0（未同意），不做自动回填。
--
-- 如果运营确认需要兼容旧逻辑（将已有隐私同意记录视为也同意了画像同步），
-- 请取消下方注释后手动执行：
--
-- UPDATE `sxo_activity_signup`
-- SET `profile_sync_agreed` = 1,
--     `profile_sync_agreed_time` = `privacy_agreed_time`
-- WHERE `privacy_agreed_time` > 0
--   AND `profile_sync_agreed` = 0;
--
-- ⚠️ 执行前请确认：
--   1. 已通知用户画像同步的用途
--   2. 已在隐私政策中说明画像同步条款
--   3. 该 UPDATE 不可逆（除非从备份恢复）
-- ============================================================

-- ============================================================
-- 三、验证查询
-- ============================================================
-- SELECT
--     COUNT(*) AS total_rows,
--     SUM(CASE WHEN profile_sync_agreed = 1 THEN 1 ELSE 0 END) AS agreed_count,
--     SUM(CASE WHEN profile_sync_agreed = 0 THEN 1 ELSE 0 END) AS not_agreed_count
-- FROM sxo_activity_signup
-- WHERE is_delete_time = 0;
--
-- 预期（未执行可选 UPDATE 时）：
--   agreed_count = 0, not_agreed_count = total_rows
