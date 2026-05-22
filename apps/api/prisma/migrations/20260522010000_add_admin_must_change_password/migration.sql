-- AddMustChangePassword: ensure must_change_password column exists in admin_users
-- This migration is idempotent: safe to run even if the column already exists from a previous migration

SET @dbname = DATABASE();
SET @tablename = 'admin_users';
SET @columnname = 'must_change_password';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `admin_users` ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT FALSE'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
