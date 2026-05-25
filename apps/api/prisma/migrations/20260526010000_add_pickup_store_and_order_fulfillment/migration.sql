-- CreateTable
CREATE TABLE `pickup_stores` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `contact_phone` VARCHAR(20) NULL,
    `province` VARCHAR(20) NOT NULL,
    `city` VARCHAR(20) NOT NULL,
    `district` VARCHAR(20) NOT NULL,
    `address` VARCHAR(200) NOT NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `business_hours` VARCHAR(100) NULL,
    `pickup_notice` VARCHAR(500) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL,
    `deleted_at` DATETIME NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_pickup_store_status` ON `pickup_stores`(`status`);

-- AlterTable: Order 新增字段
ALTER TABLE `orders` ADD COLUMN `fulfillment_type` VARCHAR(20) NOT NULL DEFAULT 'delivery';
ALTER TABLE `orders` ADD COLUMN `pickup_store_id` BIGINT NULL;
ALTER TABLE `orders` ADD COLUMN `pickup_store_name` VARCHAR(100) NULL;
ALTER TABLE `orders` ADD COLUMN `pickup_store_address` VARCHAR(300) NULL;
ALTER TABLE `orders` ADD COLUMN `pickup_contact_phone` VARCHAR(20) NULL;
ALTER TABLE `orders` ADD COLUMN `pickup_code` VARCHAR(6) NULL;
ALTER TABLE `orders` ADD COLUMN `picked_up_at` DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN `pickup_verified_by` BIGINT NULL;

-- CreateIndex
CREATE INDEX `idx_fulfillment_type` ON `orders`(`fulfillment_type`);
CREATE INDEX `idx_pickup_code` ON `orders`(`pickup_code`);

-- AlterTable: 新增 OrderStatus 枚举值
ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('pending_payment', 'paid', 'pending_delivery', 'pending_pickup', 'delivered', 'completed', 'cancelled', 'aftersale') NOT NULL DEFAULT 'pending_payment';
