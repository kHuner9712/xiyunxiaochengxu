-- Align physical MySQL unique-index names with the names Prisma derives from schema.prisma.
-- This is a metadata-only rename: indexed columns and uniqueness semantics do not change.

ALTER TABLE `flash_sale_orders`
  RENAME INDEX `uk_flash_sale_order_activity_user_order`
  TO `flash_sale_orders_activity_id_user_id_order_id_key`;

ALTER TABLE `group_buy_members`
  RENAME INDEX `uk_group_buy_member_group_user`
  TO `group_buy_members_group_id_user_id_key`;
