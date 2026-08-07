-- Rebuild denormalized coupon counters from the authoritative user_coupons rows.
-- user_coupons status contract: 1 available, 2 used, 3 expired, 4 locked.
-- Every issued user-coupon row counts toward received_count; only status=2 counts as used.

UPDATE `coupons` c
LEFT JOIN (
  SELECT
    `coupon_id`,
    COUNT(*) AS `received_count`,
    SUM(CASE WHEN `status` = 2 THEN 1 ELSE 0 END) AS `used_count`
  FROM `user_coupons`
  GROUP BY `coupon_id`
) actual ON actual.`coupon_id` = c.`id`
SET
  c.`received_count` = COALESCE(actual.`received_count`, 0),
  c.`used_count` = COALESCE(actual.`used_count`, 0);
