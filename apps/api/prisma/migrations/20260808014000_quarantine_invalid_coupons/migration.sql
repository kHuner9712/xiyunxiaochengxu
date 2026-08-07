-- Keep historical coupon/user-coupon records for audit and already-issued rights, but stop
-- issuing coupon definitions that the current checkout contract cannot execute safely.

-- Preserve a visible repair hint when the historical scope JSON itself is unreadable.
UPDATE `coupons`
SET
  `status` = 0,
  `applicable_ids` = JSON_OBJECT(
    'ids', JSON_ARRAY(),
    'description', '历史适用范围配置损坏，已自动停止继续发放；请在后台重新配置适用范围后再启用'
  )
WHERE `deleted_at` IS NULL
  AND (
    `applicable_ids` IS NULL
    OR JSON_VALID(`applicable_ids`) = 0
  );

-- The admin product exposes only the three implemented economic types:
-- 1 fixed reduction, 2 percentage discount, 3 no-threshold fixed reduction.
UPDATE `coupons`
SET `status` = 0
WHERE `deleted_at` IS NULL
  AND (
    `type` NOT IN (1, 2, 3)
    OR `value` <= 0
    OR (`type` = 2 AND `value` > 100)
    OR `per_limit` <= 0
    OR `total_count` < 0
    OR `start_time` >= `end_time`
    OR `applicable_type` NOT IN (0, 1, 2)
  );

-- Type 3 is explicitly a no-threshold fixed-value coupon.
UPDATE `coupons`
SET `min_amount` = 0
WHERE `deleted_at` IS NULL
  AND `type` = 3
  AND `min_amount` <> 0;

-- Stop further issuance when a scoped coupon has no usable ids. Support both legacy JSON arrays
-- and the new {"ids": [...], "description": "..."} envelope.
UPDATE `coupons`
SET `status` = 0
WHERE `deleted_at` IS NULL
  AND `applicable_type` IN (1, 2)
  AND JSON_VALID(`applicable_ids`) = 1
  AND (
    (JSON_TYPE(CAST(`applicable_ids` AS JSON)) = 'ARRAY'
      AND JSON_LENGTH(CAST(`applicable_ids` AS JSON)) = 0)
    OR
    (JSON_TYPE(CAST(`applicable_ids` AS JSON)) = 'OBJECT'
      AND COALESCE(JSON_LENGTH(JSON_EXTRACT(CAST(`applicable_ids` AS JSON), '$.ids')), 0) = 0)
  );
