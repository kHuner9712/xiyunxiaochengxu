-- ============================================================
-- 活动枚举体系漂移修复 - 数据迁移脚本
-- 目的：将数据库中旧的 stage/category 值统一迁移为标准值
-- 执行前请备份相关表
-- ============================================================

-- 1. sxo_activity 表 - stage 字段迁移
UPDATE `sxo_activity` SET `stage` = 'pregnancy' WHERE `stage` = 'pregnant';
UPDATE `sxo_activity` SET `stage` = 'postpartum' WHERE `stage` IN ('newborn', 'infant');

-- 2. sxo_activity 表 - category 字段迁移
UPDATE `sxo_activity` SET `category` = 'classroom' WHERE `category` IN ('maternity', 'other', 'class');
UPDATE `sxo_activity` SET `category` = 'lecture' WHERE `category` IN ('parenting', 'early_edu');
UPDATE `sxo_activity` SET `category` = 'holiday' WHERE `category` = 'activity';

-- 3. sxo_activity_signup 表 - stage 字段迁移
UPDATE `sxo_activity_signup` SET `stage` = 'pregnancy' WHERE `stage` = 'pregnant';
UPDATE `sxo_activity_signup` SET `stage` = 'postpartum' WHERE `stage` IN ('newborn', 'infant');

-- 4. sxo_user 表 - current_stage 字段迁移
UPDATE `sxo_user` SET `current_stage` = 'pregnancy' WHERE `current_stage` = 'pregnant';
UPDATE `sxo_user` SET `current_stage` = 'postpartum' WHERE `current_stage` IN ('newborn', 'infant');

-- 5. 验证：检查是否还有旧值残留
-- SELECT DISTINCT `stage` FROM `sxo_activity` WHERE `stage` NOT IN ('prepare', 'pregnancy', 'postpartum', 'all', '');
-- SELECT DISTINCT `category` FROM `sxo_activity` WHERE `category` NOT IN ('classroom', 'salon', 'lecture', 'trial', 'holiday', 'checkin', '');
-- SELECT DISTINCT `stage` FROM `sxo_activity_signup` WHERE `stage` NOT IN ('prepare', 'pregnancy', 'postpartum', '');
-- SELECT DISTINCT `current_stage` FROM `sxo_user` WHERE `current_stage` NOT IN ('prepare', 'pregnancy', 'postpartum', '');
