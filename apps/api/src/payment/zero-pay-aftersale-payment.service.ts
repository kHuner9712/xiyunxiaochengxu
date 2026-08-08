import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { generateRefundNo } from '@baby-mall/shared';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { REFUND_STATUS } from '../common/constants';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { RedisService } from '../common/redis/redis.service';
import { ShareService } from '../share/share.service';
import { PointConservingPaymentService } from './point-conserving-payment.service';
import { calculateRefundPointTargets } from './refund-points-conservation';

const ZERO_POINT_TASK_REASON = 'zero_refund_points_conservation';
const ZERO_RESTORE_SOURCE = 'zero_refund_restore';
const ZERO_CLAWBACK_SOURCE = 'zero_reward_reconcile';
const COMPLETION_REWARD_SOURCES = ['order_complete', 'order_auto_complete'];

interface ZeroPayBenefitRefundCapability {
  assertRefundable(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
  freezeForRefund(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
  restoreAfterRefundClosed(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
  revokeAfterRefundSuccess(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
}

interface ZeroPayGroupBuyRefundCapability {
  handleRefundSuccess(orderId: bigint | string): Promise<unknown>;
}

@Injectable()
export class ZeroPayAftersalePaymentService extends PointConservingPaymentService {
  private readonly zeroPayLogger = new Logger(ZeroPayAftersalePaymentService.name);

  constructor(
    private readonly zeroPayPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    @Inject(BenefitPackageService)
    private readonly zeroPayBenefitPackageService: BenefitPackageService & ZeroPayBenefitRefundCapability,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService)
    private readonly zeroPayGroupBuyService: GroupBuyService & ZeroPayGroupBuyRefundCapability,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      zeroPayPrisma,
      configService,
      businessEvent,
      orderService,
      shareService,
      zeroPayBenefitPackageService,
      merchantSettlementService,
      zeroPayGroupBuyService,
      flashSaleService,
      redisService,
    );
  }

  override async createRefund(params: {
    orderId: string;
    refundAmount: number;
    reason?: string;
    aftersaleId?: string;
  }) {
    const orderId = parsePositiveBigIntId(params.orderId, '订单');
    const order = await this.zeroPayPrisma.order.findUnique({
      where: { id: orderId },
      select: { payAmount: true },
    });
    if (!order || (order.payAmount ?? 0) !== 0) {
      return super.createRefund(params);
    }

    return this.createZeroPayAftersaleRefund({
      ...params,
      orderId,
    });
  }

  override async reconcileRefundSuccessSideEffects(limit = 200) {
    const standard = await super.reconcileRefundSuccessSideEffects(limit);
    const zeroPayPoints = await this.reconcileZeroPayRefundPoints(limit);
    return { ...standard, zeroPayPoints };
  }

  private async createZeroPayAftersaleRefund(params: {
    orderId: bigint;
    refundAmount: number;
    reason?: string;
    aftersaleId?: string;
  }) {
    if (!Number.isSafeInteger(params.refundAmount) || params.refundAmount !== 0) {
      throw new BadRequestException('0元订单退款金额必须为0分');
    }
    if (!params.aftersaleId) {
      throw new BadRequestException('0元订单退款必须关联售后单');
    }
    const aftersaleId = parsePositiveBigIntId(params.aftersaleId, '售后单');

    const snapshot = await this.zeroPayPrisma.aftersaleOrder.findFirst({
      where: { id: aftersaleId, orderId: params.orderId },
      include: {
        orderItem: true,
        order: { include: { payment: true } },
      },
    });
    if (!snapshot) throw new NotFoundException('售后单不存在');
    if ((snapshot.order.payAmount ?? 0) !== 0) throw new BadRequestException('订单不是0元订单');
    if (snapshot.order.status !== OrderStatus.aftersale && snapshot.status !== 'refunded') {
      throw new BadRequestException('订单状态不允许0元售后结算');
    }
    if (!snapshot.order.payment || snapshot.order.payment.status !== PAYMENT_STATUS.SUCCESS) {
      throw new BadRequestException('0元订单支付状态异常，无法售后结算');
    }
    if (snapshot.refundAmount !== 0) throw new BadRequestException('0元售后退款金额状态异常');

    const existing = await this.zeroPayPrisma.orderRefund.findFirst({
      where: { aftersaleId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.status === REFUND_STATUS.SUCCESS && snapshot.status === 'refunded') {
      await this.bestEffortZeroPayPostRefund(snapshot.orderId, aftersaleId);
      return {
        refundId: existing.id.toString(),
        refundNo: existing.refundNo,
        outRefundNo: existing.outRefundNo,
        status: REFUND_STATUS.SUCCESS,
        zeroPay: true,
      };
    }
    if (snapshot.status !== 'pending_refund') {
      throw new BadRequestException(`售后单状态不允许0元退款: ${snapshot.status}`);
    }

    await this.zeroPayBenefitPackageService.assertRefundable(params.orderId, aftersaleId);
    await this.zeroPayBenefitPackageService.freezeForRefund(params.orderId, aftersaleId);

    let result: { id: bigint; refundNo: string; outRefundNo: string };
    try {
      result = await this.zeroPayPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${params.orderId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM aftersale_orders WHERE id = ${aftersaleId} FOR UPDATE`;

        const current = await tx.aftersaleOrder.findFirst({
          where: { id: aftersaleId, orderId: params.orderId },
          include: {
            orderItem: true,
            order: { include: { payment: true } },
          },
        });
        if (!current) throw new NotFoundException('售后单不存在');

        const currentRefund = await tx.orderRefund.findFirst({
          where: { aftersaleId },
          orderBy: { createdAt: 'desc' },
        });
        if (current.status === 'refunded' && currentRefund?.status === REFUND_STATUS.SUCCESS) {
          return {
            id: currentRefund.id,
            refundNo: currentRefund.refundNo,
            outRefundNo: currentRefund.outRefundNo,
          };
        }
        if (current.status !== 'pending_refund') {
          throw new BadRequestException(`售后单状态已变化: ${current.status}`);
        }
        if ((current.order.payAmount ?? 0) !== 0) throw new BadRequestException('订单已不是0元订单');
        if (!current.order.payment || current.order.payment.status !== PAYMENT_STATUS.SUCCESS) {
          throw new BadRequestException('0元订单支付状态异常');
        }

        if (current.type === 2) {
          await tx.$queryRaw`SELECT id FROM product_skus WHERE id = ${current.orderItem.skuId} FOR UPDATE`;
          const sku = await tx.productSku.findUnique({
            where: { id: current.orderItem.skuId },
            select: { stock: true, sales: true },
          });
          if (!sku) throw new NotFoundException('退款商品SKU不存在');
          const quantity = current.orderItem.quantity;
          const afterStock = sku.stock + quantity;
          const afterSales = Math.max(0, sku.sales - quantity);
          await tx.productSku.update({
            where: { id: current.orderItem.skuId },
            data: { stock: afterStock, sales: afterSales },
          });
          await tx.productStockLog.create({
            data: {
              productId: current.orderItem.productId,
              skuId: current.orderItem.skuId,
              type: 4,
              quantity,
              beforeStock: sku.stock,
              afterStock,
              reason: '0元售后退款归还库存',
            },
          });
        }

        const claimed = await tx.aftersaleOrder.updateMany({
          where: { id: aftersaleId, status: 'pending_refund' },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            activeOrderItemId: null,
          },
        });
        if (claimed.count !== 1) throw new BadRequestException('售后状态已变化，请刷新后重试');
        await tx.aftersaleLog.create({
          data: {
            aftersaleId,
            operatorType: 'system',
            action: 'refund',
            content: '0元订单售后结算成功，无需调用微信退款',
          },
        });

        const otherActive = await tx.aftersaleOrder.findFirst({
          where: {
            orderId: params.orderId,
            id: { not: aftersaleId },
            status: { notIn: ['closed', 'rejected', 'refunded'] },
          },
          select: { id: true },
        });
        if (!otherActive) {
          await tx.order.update({
            where: { id: params.orderId },
            data: { status: current.order.completedAt ? OrderStatus.completed : OrderStatus.delivered },
          });
        }

        const refundNo = currentRefund?.refundNo || generateRefundNo();
        const refundRecord = currentRefund
          ? await tx.orderRefund.update({
              where: { id: currentRefund.id },
              data: {
                status: REFUND_STATUS.SUCCESS,
                refundAmount: 0,
                totalAmount: 0,
                refundId: `ZERO-${aftersaleId}`,
                reason: params.reason || current.reason,
                notifiedAt: new Date(),
                rawResponse: { zeroPay: true, localSettlement: true },
              },
            })
          : await tx.orderRefund.create({
              data: {
                orderId: params.orderId,
                paymentId: current.order.payment.id,
                aftersaleId,
                refundNo,
                outTradeNo: current.order.orderNo,
                transactionId: current.order.payment.transactionId,
                outRefundNo: refundNo,
                refundId: `ZERO-${aftersaleId}`,
                totalAmount: 0,
                refundAmount: 0,
                reason: params.reason || current.reason,
                status: REFUND_STATUS.SUCCESS,
                notifiedAt: new Date(),
                rawRequest: { zeroPay: true, localSettlement: true },
                rawResponse: { zeroPay: true, localSettlement: true },
              },
            });

        return {
          id: refundRecord.id,
          refundNo: refundRecord.refundNo,
          outRefundNo: refundRecord.outRefundNo,
        };
      });
    } catch (error) {
      await this.zeroPayBenefitPackageService.restoreAfterRefundClosed(params.orderId, aftersaleId).catch(() => undefined);
      throw error;
    }

    await this.bestEffortZeroPayPostRefund(params.orderId, aftersaleId);
    return {
      refundId: result.id.toString(),
      refundNo: result.refundNo,
      outRefundNo: result.outRefundNo,
      status: REFUND_STATUS.SUCCESS,
      zeroPay: true,
    };
  }

  private async bestEffortZeroPayPostRefund(orderId: bigint, aftersaleId: bigint) {
    try {
      await this.zeroPayBenefitPackageService.revokeAfterRefundSuccess(orderId, aftersaleId);
    } catch (error) {
      this.zeroPayLogger.error(
        `0元退款权益撤销失败，将由退款副作用对账补偿: orderId=${orderId}, aftersaleId=${aftersaleId}, error=${(error as Error).message}`,
      );
    }
    try {
      await this.zeroPayGroupBuyService.handleRefundSuccess(orderId);
    } catch (error) {
      this.zeroPayLogger.error(
        `0元退款拼团副作用处理失败，将由退款副作用对账补偿: orderId=${orderId}, error=${(error as Error).message}`,
      );
    }
    try {
      await this.reconcileZeroPayOrderPoints(orderId);
    } catch (error) {
      this.zeroPayLogger.error(
        `0元退款积分守恒即时对账失败，将由定时任务补偿: orderId=${orderId}, error=${(error as Error).message}`,
      );
    }
  }

  private async reconcileZeroPayRefundPoints(limit = 200) {
    const candidates = await this.zeroPayPrisma.$queryRaw<Array<{ orderId: bigint }>>`
      SELECT o.id AS orderId
      FROM orders o
      INNER JOIN (
        SELECT order_id, MAX(refunded_at) AS latest_refunded_at
        FROM aftersale_orders
        WHERE status = 'refunded'
        GROUP BY order_id
      ) a ON a.order_id = o.id
      LEFT JOIN payment_compensation_tasks task
        ON task.order_no = o.order_no
       AND task.reason = ${ZERO_POINT_TASK_REASON}
       AND task.transaction_id = CONCAT('zero-refund-points:', o.id)
      WHERE o.pay_amount = 0
        AND (
          task.id IS NULL
          OR task.handled_at IS NULL
          OR a.latest_refunded_at > task.handled_at
        )
      ORDER BY a.latest_refunded_at ASC, o.id ASC
      LIMIT ${limit}
    `;

    let resolved = 0;
    let debtPending = 0;
    let failed = 0;
    for (const candidate of candidates) {
      try {
        const result = await this.reconcileZeroPayOrderPoints(candidate.orderId);
        if (result.outstandingRewardClawback > 0) debtPending += 1;
        else resolved += 1;
      } catch (error) {
        failed += 1;
        this.zeroPayLogger.error(
          `0元退款积分守恒补偿失败: orderId=${candidate.orderId}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: candidates.length, resolved, debtPending, failed };
  }

  private async reconcileZeroPayOrderPoints(orderId: bigint) {
    return this.zeroPayPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { orderItems: true },
      });
      if (!order) throw new NotFoundException('0元退款积分对账订单不存在');
      if ((order.payAmount ?? 0) !== 0) return { outstandingRewardClawback: 0 };

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${order.userId} FOR UPDATE`;
      const user = await tx.user.findFirst({
        where: { id: order.userId, deletedAt: null },
        select: { availablePoints: true },
      });
      if (!user) throw new NotFoundException('0元退款积分对账用户不存在');

      const refundedAftersales = await tx.aftersaleOrder.findMany({
        where: { orderId, status: 'refunded' },
        select: { id: true, orderItemId: true },
        orderBy: { id: 'asc' },
      });
      if (refundedAftersales.length === 0) return { outstandingRewardClawback: 0 };

      const refundedItemIds = new Set(refundedAftersales.map((item) => item.orderItemId.toString()));
      const itemWeight = (item: { subtotal: number; price: number; quantity: number }) =>
        Math.max(0, item.subtotal || item.price * item.quantity);
      const totalWeight = order.orderItems.reduce((sum, item) => sum + itemWeight(item), 0);
      const refundedWeight = order.orderItems.reduce(
        (sum, item) => sum + (refundedItemIds.has(item.id.toString()) ? itemWeight(item) : 0),
        0,
      );
      if (totalWeight <= 0) throw new BadRequestException('0元订单商品金额权重无效，无法计算积分退款比例');

      const completionReward = await tx.pointsRecord.aggregate({
        where: {
          userId: order.userId,
          type: 1,
          sourceId: order.id,
          source: { in: COMPLETION_REWARD_SOURCES },
        },
        _sum: { points: true },
      });
      const aftersaleIds = refundedAftersales.map((item) => item.id);
      const [restored, clawed] = await Promise.all([
        tx.pointsRecord.aggregate({
          where: {
            userId: order.userId,
            type: 1,
            source: ZERO_RESTORE_SOURCE,
            sourceId: { in: aftersaleIds },
          },
          _sum: { points: true },
        }),
        tx.pointsRecord.aggregate({
          where: {
            userId: order.userId,
            type: 2,
            source: ZERO_CLAWBACK_SOURCE,
            sourceId: { in: aftersaleIds },
          },
          _sum: { points: true },
        }),
      ]);

      let restoredPoints = Math.max(0, restored._sum.points ?? 0);
      let clawedPoints = Math.max(0, clawed._sum.points ?? 0);
      const targets = calculateRefundPointTargets({
        payAmount: totalWeight,
        cumulativeRefundAmount: refundedWeight,
        originalDeductedPoints: Math.max(0, order.pointsDeducted),
        originalRewardPoints: Math.max(0, completionReward._sum.points ?? 0),
      });
      const latestAftersale = refundedAftersales[refundedAftersales.length - 1];
      let availablePoints = user.availablePoints;

      const restoreDelta = Math.max(0, targets.restoreDeductedTarget - restoredPoints);
      if (restoreDelta > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { availablePoints: { increment: restoreDelta } },
        });
        availablePoints += restoreDelta;
        restoredPoints += restoreDelta;
        await tx.pointsRecord.create({
          data: {
            userId: order.userId,
            type: 1,
            points: restoreDelta,
            balance: availablePoints,
            source: ZERO_RESTORE_SOURCE,
            sourceId: latestAftersale.id,
            description: `0元订单累计售后积分守恒，归还抵扣积分${restoreDelta}`,
          },
        });
      }

      const clawbackDue = Math.max(0, targets.clawbackRewardTarget - clawedPoints);
      if (clawbackDue > 0 && availablePoints >= clawbackDue) {
        await tx.user.update({
          where: { id: order.userId },
          data: { availablePoints: { decrement: clawbackDue } },
        });
        availablePoints -= clawbackDue;
        clawedPoints += clawbackDue;
        await tx.pointsRecord.create({
          data: {
            userId: order.userId,
            type: 2,
            points: clawbackDue,
            balance: availablePoints,
            source: ZERO_CLAWBACK_SOURCE,
            sourceId: latestAftersale.id,
            description: `0元订单累计售后积分守恒，扣回完成奖励${clawbackDue}`,
          },
        });
      }

      const outstandingRewardClawback = Math.max(0, targets.clawbackRewardTarget - clawedPoints);
      const transactionId = `zero-refund-points:${order.id}`;
      const task = await tx.paymentCompensationTask.findFirst({
        where: { orderNo: order.orderNo, reason: ZERO_POINT_TASK_REASON, transactionId },
      });
      const payload = {
        orderId: order.id.toString(),
        refundedItemWeight: targets.cumulativeRefundAmount,
        totalItemWeight: totalWeight,
        restoreDeductedTarget: targets.restoreDeductedTarget,
        restoredPoints,
        clawbackRewardTarget: targets.clawbackRewardTarget,
        clawedRewardPoints: clawedPoints,
        outstandingRewardClawback,
      };
      const taskData = outstandingRewardClawback > 0
        ? {
            amount: null,
            status: 'pending',
            callbackPayload: payload,
            handledBy: null,
            handledAt: null,
            resolution: `0元退款完成奖励仍有${outstandingRewardClawback}积分待自动扣回；余额不足时持续重试`,
          }
        : {
            amount: null,
            status: 'resolved',
            callbackPayload: payload,
            handledBy: 'system:zero-refund-points',
            handledAt: new Date(),
            resolution: '0元订单累计售后与积分返还/奖励扣回已严格守恒',
          };
      if (task) {
        await tx.paymentCompensationTask.update({ where: { id: task.id }, data: taskData });
      } else {
        await tx.paymentCompensationTask.create({
          data: {
            orderNo: order.orderNo,
            transactionId,
            reason: ZERO_POINT_TASK_REASON,
            ...taskData,
          },
        });
      }

      return { outstandingRewardClawback };
    });
  }
}
