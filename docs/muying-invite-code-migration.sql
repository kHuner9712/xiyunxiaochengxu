-- ============================================================
-- 邀请码字段迁移脚本
-- 创建时间: 2026-04-17
-- 说明: 用户表增加 invite_code 字段和唯一索引，补齐老用户邀请码
-- 依赖: 先执行 muying-migration.sql (建表)
-- ============================================================

-- -----------------------------------------------------------
-- 1. 用户表增加 invite_code 字段
-- -----------------------------------------------------------
ALTER TABLE `sxo_user` ADD COLUMN `invite_code` char(8) NOT NULL DEFAULT '' COMMENT '邀请码' AFTER `baby_birthday`;

-- -----------------------------------------------------------
-- 2. 为已有用户生成唯一邀请码
-- 采用随机8位字母数字组合，确保唯一
-- -----------------------------------------------------------
-- 注意：以下存储过程需要逐行更新，避免批量生成导致冲突
DELIMITER //

DROP PROCEDURE IF EXISTS `muying_fill_invite_code`//

CREATE PROCEDURE `muying_fill_invite_code`()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id INT;
    DECLARE v_code CHAR(8);
    DECLARE v_exists INT;
    DECLARE cur CURSOR FOR SELECT `id` FROM `sxo_user` WHERE `invite_code` = '' OR `invite_code` IS NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO v_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET v_exists = 1;
        WHILE v_exists > 0 DO
            SET v_code = UPPER(SUBSTRING(MD5(RAND() + UNIX_TIMESTAMP() + v_id), 1, 8));
            SELECT COUNT(*) INTO v_exists FROM `sxo_user` WHERE `invite_code` = v_code;
        END WHILE;

        UPDATE `sxo_user` SET `invite_code` = v_code WHERE `id` = v_id;
    END LOOP;
    CLOSE cur;
END//

DELIMITER ;

CALL `muying_fill_invite_code`();

DROP PROCEDURE IF EXISTS `muying_fill_invite_code`;

-- -----------------------------------------------------------
-- 3. 添加唯一索引
-- -----------------------------------------------------------
ALTER TABLE `sxo_user` ADD UNIQUE INDEX `uk_invite_code` (`invite_code`);
