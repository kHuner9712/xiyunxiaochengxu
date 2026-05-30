ALTER TABLE `orders` MODIFY COLUMN `pickup_code` VARCHAR(8) NULL;

DROP INDEX `idx_pickup_code` ON `orders`;

CREATE UNIQUE INDEX `uk_pickup_code` ON `orders`(`pickup_code`);
