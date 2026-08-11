import { Injectable } from '@nestjs/common';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentFactDashboardService } from './payment-fact-dashboard.service';

@Injectable()
export class NetPaidProductDashboardService extends PaymentFactDashboardService {
  constructor(private readonly netPaidPrisma: PrismaService) {
    super(netPaidPrisma);
  }

  override async getTopProducts(limit = 10) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;

    // Keep product sales accounting aligned with item-level refund allocation:
    // 1. allocate only the order's successful non-freight paid amount;
    // 2. use subtotal + item activity discount as the economic basis;
    // 3. zero-subtotal gifts have zero cash basis;
    // 4. never allocate more cash to an item than its persisted subtotal;
    // 5. distribute remaining cents round-robin in largest-remainder order.
    //
    // All order items remain in the allocation denominator even when a product is later
    // disabled/deleted. Product visibility is filtered only after allocation so historical money
    // is not reassigned to a different product merely because catalog state changed.
    const rows = await this.netPaidPrisma.$queryRaw<Array<{
      productId: bigint;
      salesCount: bigint | number;
      salesAmount: bigint | number;
    }>>`
      WITH item_rows AS (
        SELECT
          oi.id AS item_id,
          oi.order_id,
          oi.product_id,
          oi.quantity,
          GREATEST(COALESCE(oi.subtotal, 0), 0) AS subtotal,
          CASE
            WHEN GREATEST(COALESCE(oi.subtotal, 0), 0) = 0 THEN 0
            ELSE GREATEST(COALESCE(oi.subtotal, 0) + COALESCE(oi.activity_discount, 0), 0)
          END AS economic_basis,
          GREATEST(COALESCE(op.amount, 0) - COALESCE(o.freight_amount, 0), 0) AS non_freight_paid
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        INNER JOIN order_payments op ON op.order_id = o.id
        WHERE op.status = ${PAYMENT_STATUS.SUCCESS}
      ), order_totals AS (
        SELECT
          order_id,
          MAX(non_freight_paid) AS non_freight_paid,
          SUM(subtotal) AS subtotal_sum,
          SUM(economic_basis) AS basis_sum
        FROM item_rows
        GROUP BY order_id
      ), exact_alloc AS (
        SELECT
          ir.item_id,
          ir.order_id,
          ir.product_id,
          ir.quantity,
          ir.subtotal AS allocated_paid
        FROM item_rows ir
        INNER JOIN order_totals ot ON ot.order_id = ir.order_id
        WHERE ot.subtotal_sum = ot.non_freight_paid
      ), proportional_base AS (
        SELECT
          ir.item_id,
          ir.order_id,
          ir.product_id,
          ir.quantity,
          ir.subtotal,
          ir.economic_basis,
          ot.non_freight_paid,
          CASE
            WHEN ot.basis_sum > 0 THEN LEAST(
              ir.subtotal,
              FLOOR(ot.non_freight_paid * ir.economic_basis / ot.basis_sum)
            )
            ELSE 0
          END AS base_alloc,
          CASE
            WHEN ot.basis_sum > 0 THEN
              ot.non_freight_paid * ir.economic_basis
              - FLOOR(ot.non_freight_paid * ir.economic_basis / ot.basis_sum) * ot.basis_sum
            ELSE 0
          END AS remainder_num
        FROM item_rows ir
        INNER JOIN order_totals ot ON ot.order_id = ir.order_id
        WHERE ot.subtotal_sum <> ot.non_freight_paid
      ), with_capacity AS (
        SELECT
          pb.*,
          GREATEST(pb.subtotal - pb.base_alloc, 0) AS capacity
        FROM proportional_base pb
      ), base_totals AS (
        SELECT
          order_id,
          MAX(non_freight_paid) AS non_freight_paid,
          SUM(base_alloc) AS base_sum,
          GREATEST(MAX(non_freight_paid) - SUM(base_alloc), 0) AS residue
        FROM with_capacity
        GROUP BY order_id
      ), capacity_thresholds AS (
        SELECT
          a.order_id,
          a.capacity AS threshold_capacity,
          SUM(LEAST(b.capacity, a.capacity)) AS distributed_at_threshold
        FROM with_capacity a
        INNER JOIN with_capacity b ON b.order_id = a.order_id
        WHERE a.capacity > 0
        GROUP BY a.order_id, a.capacity
      ), baseline AS (
        SELECT
          bt.order_id,
          bt.residue,
          COALESCE(MAX(ct.threshold_capacity), 0) AS baseline_rounds
        FROM base_totals bt
        LEFT JOIN capacity_thresholds ct
          ON ct.order_id = bt.order_id
         AND ct.distributed_at_threshold <= bt.residue
        GROUP BY bt.order_id, bt.residue
      ), baseline_stats AS (
        SELECT
          wc.order_id,
          b.residue,
          b.baseline_rounds,
          SUM(LEAST(wc.capacity, b.baseline_rounds)) AS distributed_at_baseline,
          SUM(CASE WHEN wc.capacity > b.baseline_rounds THEN 1 ELSE 0 END) AS active_count
        FROM with_capacity wc
        INNER JOIN baseline b ON b.order_id = wc.order_id
        GROUP BY wc.order_id, b.residue, b.baseline_rounds
      ), round_plan AS (
        SELECT
          bs.order_id,
          CASE
            WHEN bs.active_count > 0 THEN
              bs.baseline_rounds
              + FLOOR(
                  GREATEST(bs.residue - bs.distributed_at_baseline, 0)
                  / bs.active_count
                )
            ELSE bs.baseline_rounds
          END AS full_round_level,
          CASE
            WHEN bs.active_count > 0 THEN
              MOD(
                GREATEST(bs.residue - bs.distributed_at_baseline, 0),
                bs.active_count
              )
            ELSE 0
          END AS partial_round_count
        FROM baseline_stats bs
      ), ranked AS (
        SELECT
          wc.*,
          rp.full_round_level,
          rp.partial_round_count,
          SUM(
            CASE WHEN wc.capacity > rp.full_round_level THEN 1 ELSE 0 END
          ) OVER (
            PARTITION BY wc.order_id
            ORDER BY wc.remainder_num DESC, wc.item_id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS active_remainder_rank
        FROM with_capacity wc
        INNER JOIN round_plan rp ON rp.order_id = wc.order_id
      ), proportional_alloc AS (
        SELECT
          item_id,
          order_id,
          product_id,
          quantity,
          base_alloc
            + LEAST(capacity, full_round_level)
            + CASE
                WHEN capacity > full_round_level
                 AND active_remainder_rank <= partial_round_count
                THEN 1
                ELSE 0
              END AS allocated_paid
        FROM ranked
      ), allocated AS (
        SELECT product_id, quantity, allocated_paid FROM exact_alloc
        UNION ALL
        SELECT product_id, quantity, allocated_paid FROM proportional_alloc
      )
      SELECT
        product_id AS productId,
        SUM(quantity) AS salesCount,
        SUM(allocated_paid) AS salesAmount
      FROM allocated
      GROUP BY product_id
      ORDER BY salesCount DESC, salesAmount DESC, product_id ASC
      LIMIT ${safeLimit}
    `;

    const productIds = rows.map((row) => row.productId);
    const products = productIds.length
      ? await this.netPaidPrisma.product.findMany({
          where: { id: { in: productIds }, deletedAt: null, status: 1 },
          select: {
            id: true,
            name: true,
            mainImage: true,
            totalSales: true,
            minPrice: true,
          },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id.toString(), product]));

    return rows.flatMap((row) => {
      const product = productMap.get(row.productId.toString());
      return product
        ? [{
            ...product,
            id: product.id.toString(),
            image: product.mainImage || '',
            salesCount: Number(row.salesCount || 0),
            salesAmount: Number(row.salesAmount || 0),
          }]
        : [];
    });
  }
}
