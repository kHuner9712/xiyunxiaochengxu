-- Repair production environments where the earlier promotion-index alignment migration
-- was already recorded as applied before its guarded index-name convergence logic landed.
-- Fresh databases may already have the Prisma-derived names, so every operation is idempotent.
-- Indexed columns and uniqueness semantics are unchanged.

SET @schema_name = DATABASE();

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
SET @sql = IF(
  @new_index_exists > 0,
  'SELECT 1',
  IF(
    @old_index_exists > 0,
    'ALTER TABLE `flash_sale_orders` RENAME INDEX `uk_flash_sale_order_activity_user_order` TO `flash_sale_orders_activity_id_user_id_order_id_key`',
    'ALTER TABLE `flash_sale_orders` ADD UNIQUE INDEX `flash_sale_orders_activity_id_user_id_order_id_key` (`activity_id`, `user_id`, `order_id`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
SET @sql = IF(
  @new_index_exists > 0,
  'SELECT 1',
  IF(
    @old_index_exists > 0,
    'ALTER TABLE `group_buy_members` RENAME INDEX `uk_group_buy_member_group_user` TO `group_buy_members_group_id_user_id_key`',
    'ALTER TABLE `group_buy_members` ADD UNIQUE INDEX `group_buy_members_group_id_user_id_key` (`group_id`, `user_id`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
