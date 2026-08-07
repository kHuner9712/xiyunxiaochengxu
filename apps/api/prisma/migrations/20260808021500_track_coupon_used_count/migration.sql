-- Keep coupons.used_count synchronized with the authoritative user_coupons status transition.
-- This is deliberately limited to the denormalized used_count field; issuance continues to be
-- controlled transactionally by application code so stock/per-user eligibility stays explicit.

DROP TRIGGER IF EXISTS `trg_user_coupons_used_count_after_update`;

CREATE TRIGGER `trg_user_coupons_used_count_after_update`
AFTER UPDATE ON `user_coupons`
FOR EACH ROW
UPDATE `coupons`
SET `used_count` = GREATEST(
  0,
  `used_count` + CASE
    WHEN OLD.`status` <> 2 AND NEW.`status` = 2 THEN 1
    WHEN OLD.`status` = 2 AND NEW.`status` <> 2 THEN -1
    ELSE 0
  END
)
WHERE `id` = NEW.`coupon_id`
  AND (
    (OLD.`status` <> 2 AND NEW.`status` = 2)
    OR (OLD.`status` = 2 AND NEW.`status` <> 2)
  );
