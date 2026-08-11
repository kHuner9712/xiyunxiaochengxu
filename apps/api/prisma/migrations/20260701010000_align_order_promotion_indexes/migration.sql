-- Close remaining drift between migration-built MySQL databases and schema.prisma.
-- Every operation is guarded so existing environments with manually-added columns/indexes remain deployable.

SET @schema_name = DATABASE();

-- Orders: promotion attribution columns used by runtime order creation.
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `orders` ADD COLUMN `source_type` VARCHAR(30) NOT NULL DEFAULT ''direct'' AFTER `source`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'source_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `orders` ADD COLUMN `source_code` VARCHAR(64) NULL AFTER `source_type`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'source_code'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `orders` ADD COLUMN `share_record_id` BIGINT NULL AFTER `source_code`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'share_record_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `orders` ADD COLUMN `share_campaign_id` BIGINT NULL AFTER `share_record_id`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'share_campaign_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `orders` ADD COLUMN `referrer_user_id` BIGINT NULL AFTER `share_campaign_id`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'referrer_user_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Orders: attribution lookup indexes.
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_order_source_type` ON `orders` (`source_type`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_source_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_order_source_code` ON `orders` (`source_code`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_source_code'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_order_share_record_id` ON `orders` (`share_record_id`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_share_record_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_order_share_campaign_id` ON `orders` (`share_campaign_id`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_share_campaign_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_order_referrer_user_id` ON `orders` (`referrer_user_id`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_referrer_user_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Products: indexes declared by Prisma but absent from migration history.
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_product_type` ON `products` (`product_type`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_product_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_product_fulfillment_type` ON `products` (`fulfillment_type`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_product_fulfillment_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `idx_business_category` ON `products` (`business_category`)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_business_category'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Prisma 5.22 expects generated database names for these compound unique constraints.
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
