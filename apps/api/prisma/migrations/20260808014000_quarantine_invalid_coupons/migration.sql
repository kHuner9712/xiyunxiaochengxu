-- Keep historical coupon/user-coupon records for audit and already-issued rights, but stop
-- issuing coupon definitions that the current checkout contract cannot execute safely.
-- The coupons table has no deleted_at column; all checks below intentionally use only columns
-- that exist in the Prisma schema and in the migration-built database.

-- The admin product and checkout support exactly three economic types:
-- 1 fixed reduction, 2 percentage discount, 3 no-threshold fixed reduction.
UPDATE `coupons`
SET `status` = 0
WHERE
  `type` NOT IN (1, 2, 3)
  OR `value` <= 0
  OR (`type` = 2 AND `value` > 100)
  OR `per_limit` <= 0
  OR `total_count` < 0
  OR `start_time` >= `end_time`
  OR `applicable_type` NOT IN (0, 1, 2);

-- Type 3 is explicitly a no-threshold fixed-value coupon.
UPDATE `coupons`
SET `min_amount` = 0
WHERE `type` = 3
  AND `min_amount` <> 0;

-- Stop further issuance when a scoped coupon has no usable ids. The JSON column may contain
-- either the legacy array form ["1", "2"] or the metadata envelope
-- {"ids": ["1", "2"], "description": "..."}.
UPDATE `coupons`
SET `status` = 0
WHERE `applicable_type` IN (1, 2)
  AND (
    `applicable_ids` IS NULL
    OR (JSON_TYPE(`applicable_ids`) = 'ARRAY' AND JSON_LENGTH(`applicable_ids`) = 0)
    OR (
      JSON_TYPE(`applicable_ids`) = 'OBJECT'
      AND COALESCE(JSON_LENGTH(JSON_EXTRACT(`applicable_ids`, '$.ids')), 0) = 0
    )
    OR JSON_TYPE(`applicable_ids`) NOT IN ('ARRAY', 'OBJECT')
  );
