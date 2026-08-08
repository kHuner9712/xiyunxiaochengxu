-- Activity types 3 (满赠) and 4 (组合套餐) were historically exposed before the
-- repository had a complete gift/package SKU, stock, checkout and refund model.
-- Keep the records for audit/history, but make their persisted status truthful so operators do
-- not see them as enabled while the public runtime intentionally refuses to sell them.
UPDATE `activities`
SET `status` = 0
WHERE `type` IN ('3', '4')
  AND `status` = 1;
