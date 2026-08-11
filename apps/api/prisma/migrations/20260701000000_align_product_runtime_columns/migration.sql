-- Align columns already required by Prisma Product with databases created from migration history.
-- The guarded statements are safe for existing environments where a column may have been added manually.

SET @schema_name = DATABASE();

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `product_type` VARCHAR(20) NOT NULL DEFAULT ''physical'' AFTER `category_id`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'product_type'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `fulfillment_type` VARCHAR(20) NOT NULL DEFAULT ''delivery'' AFTER `product_type`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'fulfillment_type'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `products` ADD COLUMN `business_category` VARCHAR(50) NOT NULL DEFAULT ''other'' AFTER `fulfillment_type`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'business_category'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
