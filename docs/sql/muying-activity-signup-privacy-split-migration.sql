-- ============================================================
-- 活动报名隐私授权拆分迁移脚本
-- 日期：2026-04-26
-- 说明：在 ActivitySignup 表增加 profile_sync_agreed 和 profile_sync_agreed_time 字段
-- ============================================================

ALTER TABLE `xo_activity_signup`
    ADD COLUMN `profile_sync_agreed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '画像同步授权 0=未同意 1=已同意' AFTER `privacy_version`,
    ADD COLUMN `profile_sync_agreed_time` INT(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT '画像同步授权时间' AFTER `profile_sync_agreed`;

-- 历史数据处理：已有 privacy_agreed_time 的记录，默认 profile_sync_agreed = 1（按旧逻辑已同步画像）
UPDATE `xo_activity_signup`
SET `profile_sync_agreed` = 1,
    `profile_sync_agreed_time` = `privacy_agreed_time`
WHERE `privacy_agreed_time` > 0
  AND `profile_sync_agreed` = 0;
