-- Rebuild denormalized coupon counters from authoritative user_coupons rows.
-- Canonical user_coupons status contract:
-- 1 FREE, 2 LOCKED, 3 USED, 4 EXPIRED.
-- Every issued user-coupon row counts toward received_count; only status=3 counts as used.

UPDATE `coupons` c
LEFT JOIN (
  SELECT
    `coupon_id`,
    COUNT(*) AS `received_count`,
    SUM(CASE WHEN `status` = 3 THEN 1 ELSE 0 END) AS `used_count`
  FROM `user_coupons`
  GROUP BY `coupon_id`
) actual ON actual.`coupon_id` = c.`id`
SET
  c.`received_count` = COALESCE(actual.`received_count`, 0),
  c.`used_count` = COALESCE(actual.`used_count`, 0);
