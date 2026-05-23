-- AlterTable: add pending_refund to aftersale_orders.status enum
-- Note: MySQL requires dropping and recreating the enum column to add new values

ALTER TABLE `aftersale_orders` 
MODIFY COLUMN `status` ENUM('pending_review', 'approved', 'rejected', 'returned', 'pending_refund', 'refunded', 'closed') 
NOT NULL DEFAULT 'pending_review';

-- CreateTable: order_refunds
CREATE TABLE `order_refunds` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `refund_no` VARCHAR(64) NOT NULL,
    `order_id` BIGINT NOT NULL,
    `aftersale_id` BIGINT NULL,
    `payment_id` BIGINT NULL,
    `out_trade_no` VARCHAR(32) NOT NULL,
    `transaction_id` VARCHAR(64) NULL,
    `out_refund_no` VARCHAR(64) NOT NULL,
    `refund_id` VARCHAR(64) NULL,
    `refund_amount` INT NOT NULL,
    `total_amount` INT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `reason` VARCHAR(200) NULL,
    `raw_request` JSON NULL,
    `raw_response` JSON NULL,
    `notified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_refund_no`(`refund_no`),
    UNIQUE INDEX `uk_out_refund_no`(`out_refund_no`),
    INDEX `idx_order_id`(`order_id`),
    INDEX `idx_aftersale_id`(`aftersale_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_refund_id`(`refund_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: order_refunds -> orders
-- Note: Following existing migration pattern of adding foreign keys after table creation
ALTER TABLE `order_refunds` 
ADD CONSTRAINT `order_refunds_order_id_fkey` 
FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) 
ON DELETE CASCADE ON UPDATE CASCADE;
