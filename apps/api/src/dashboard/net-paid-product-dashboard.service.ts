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

    // Allocate each order's actual non-freight paid cents back to its items with the same
    // largest-remainder principle used by refund accounting. This keeps every order exact to the
    // cent after member discounts, coupons, points and activity discounts instead of reporting
    // gross item subtotal as "sales amount".
    const rows = await this.netPaidPrisma.$queryRaw<Array<{
      productId: bigint;
      salesCount: bigint | number;
      salesAmount: bigint | number;
    }>>`
      WITH item_base AS (
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.quantity,
          oi.subtotal,
          GREATEST(oi.subtotal + COALESCE(oi.activity_discount, 0), 0) AS economic_basis,
          GREATEST(COALESCE(o.pay_amount, 0) - COALESCE(o.freight_amount, 0), 0) AS non_freight_paid,
          SUM(oi.subtotal) OVER (PARTITION BY oi.order_id) AS item_subtotal_sum,
          SUM(GREATEST(oi.subtotal + COALESCE(oi.activity_discount, 0), 0))
            OVER (PARTITION BY oi.order_id) AS basis_sum
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        INNER JOIN order_payments op ON op.order_id = o.id
        INNER JOIN products p ON p.id = oi.product_id
        WHERE op.status = ${PAYMENT_STATUS.SUCCESS}
          AND p.deleted_at IS NULL
          AND p.status = 1
      ), floor_alloc AS (
        SELECT
          item_base.*,
          CASE
            WHEN item_subtotal_sum = non_freight_paid THEN subtotal
            WHEN basis_sum > 0 THEN FLOOR(non_freight_paid * economic_basis / basis_sum)
            ELSE 0
          END AS base_alloc,
          CASE
            WHEN item_subtotal_sum = non_freight_paid OR basis_sum <= 0 THEN 0
            ELSE
              non_freight_paid * economic_basis
              - FLOOR(non_freight_paid * economic_basis / basis_sum) * basis_sum
          END AS remainder_num
        FROM item_base
      ), ranked AS (
        SELECT
          floor_alloc.*,
          SUM(base_alloc) OVER (PARTITION BY order_id) AS base_sum,
          ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY remainder_num DESC, id ASC
          ) AS remainder_rank
        FROM floor_alloc
      ), allocated AS (
        SELECT
          product_id,
          quantity,
          CASE
            WHEN item_subtotal_sum = non_freight_paid THEN subtotal
            WHEN basis_sum <= 0 THEN 0
            ELSE
              base_alloc
              + CASE
                  WHEN remainder_rank <= GREATEST(non_freight_paid - base_sum, 0) THEN 1
                  ELSE 0
                END
          END AS allocated_paid
        FROM ranked
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
