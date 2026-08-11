-- Reconcile the denormalized coupons.used_count without installing a database trigger.
-- Canonical user_coupons status contract: 1 FREE, 2 LOCKED, 3 USED, 4 EXPIRED.
--
-- Production migrations run with the application database account. CREATE TRIGGER can require
-- SUPER (or log_bin_trust_function_creators) when MySQL binary logging is enabled, which is an
-- inappropriate privilege requirement for the runtime/migration account. user_coupons.status is
-- the authoritative redemption state; used_count is only a denormalized reporting cache.
-- Admin reads recompute the authoritative count from user_coupons, while this migration aligns
-- any historical cached values once without elevated database privileges.

UPDATE `coupons` c
LEFT JOIN (
  SELECT
    `coupon_id`,
    COUNT(*) AS `used_count`
  FROM `user_coupons`
  WHERE `status` = 3
  GROUP BY `coupon_id`
) actual ON actual.`coupon_id` = c.`id`
SET c.`used_count` = COALESCE(actual.`used_count`, 0);
