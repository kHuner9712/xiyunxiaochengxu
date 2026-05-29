-- Add missing index for payment compensation task transaction id
CREATE INDEX `idx_transaction_id` ON `payment_compensation_tasks`(`transaction_id`);
