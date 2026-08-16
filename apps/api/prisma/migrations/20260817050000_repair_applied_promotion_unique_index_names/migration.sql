-- Repair production databases where the previous promotion-index alignment
-- migration is already recorded as applied while the physical unique-index
-- names remain on the legacy names. This migration is intentionally
-- idempotent and preserves the indexed columns and uniqueness semantics.

SET @schema_name = DATABASE();

-- flash_sale_orders(activity_id, user_id, order_id)
SET @new_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'flash_sale_orders'
    AND INDEX_NAME = 'flash_sale_orders_activity_id_user_id_order_id_key'
);
SET @old_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'flash_sale_orders'
    AND INDEX_NAME = 'uk_flash_sale_order_activity_user_order'
);
SET @sql = CASE
  WHEN @new_index_exists > 0 AND @old_index_exists > 0 THEN
    'ALTER TABLE `flash_sale_orders` DROP INDEX `uk_flash_sale_order_activity_user_order`'
  WHEN @new_index_exists > 0 THEN
    'SELECT 1'
  WHEN @old_index_exists > 0 THEN
    'ALTER TABLE `flash_sale_orders` RENAME INDEX `uk_flash_sale_order_activity_user_order` TO `flash_sale_orders_activity_id_user_id_order_id_key`'
  ELSE
    'ALTER TABLE `flash_sale_orders` ADD UNIQUE INDEX `flash_sale_orders_activity_id_user_id_order_id_key` (`activity_id`, `user_id`, `order_id`)'
END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- group_buy_members(group_id, user_id)
SET @new_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'group_buy_members'
    AND INDEX_NAME = 'group_buy_members_group_id_user_id_key'
);
SET @old_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'group_buy_members'
    AND INDEX_NAME = 'uk_group_buy_member_group_user'
);
SET @sql = CASE
  WHEN @new_index_exists > 0 AND @old_index_exists > 0 THEN
    'ALTER TABLE `group_buy_members` DROP INDEX `uk_group_buy_member_group_user`'
  WHEN @new_index_exists > 0 THEN
    'SELECT 1'
  WHEN @old_index_exists > 0 THEN
    'ALTER TABLE `group_buy_members` RENAME INDEX `uk_group_buy_member_group_user` TO `group_buy_members_group_id_user_id_key`'
  ELSE
    'ALTER TABLE `group_buy_members` ADD UNIQUE INDEX `group_buy_members_group_id_user_id_key` (`group_id`, `user_id`)'
END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
