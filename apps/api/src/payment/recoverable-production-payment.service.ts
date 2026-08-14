import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { ProductionPaymentService } from './production-payment.service';

const REFUND_SIDE_EFFECT_REASON = 'refund_success_side_effects';
const PAID_SIDE_EFFECT_REASON = 'paid_order_side_effects';
const PAID_EFFECT_ELIGIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.pending_delivery,
  OrderStatus.pending_pickup,
  OrderStatus.delivered,
  OrderStatus.completed,
];

interface RefundResult {
  status: string;
  refundId?: string;
  refundNo?: string;
  outRefundNo?: string;
}

@Injectable()
export class RecoverableProductionPaymentService extends ProductionPaymentService {
  private readonly recoveryLogger = new Logger(RecoverableProductionPaymentService.name);

  constructor(
    private readonly recoveryPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    private readonly recoveryShareService: ShareService,
    private readonly recoveryBenefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
  ) {
    super(
      recoveryPrisma,
      configService,
      businessEvent,
      orderService,
      recoveryShareService,
      recoveryBenefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
    );
  }

  override async createRefund(params: {
    orderId: string;
    aftersaleId?: string;
    refundAmount: number;
    reason?: string;
  }) {
    const latestFailed = await this.recoveryPrisma.orderRefund.findFirst({
      where: {
        orderId: BigInt(params.orderId),
        aftersaleId: params.aftersaleId ? BigInt(params.aftersaleId) : null,
        status: REFUND_STATUS.FAILED,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestFailed) {
      const resolution = await this.resolveUncertainFailedRefund(latestFailed);
      if (resolution.retryable) {
        return super.createRefund(params);
      }

      if (
        resolution.status === REFUND_STATUS.SUCCESS ||
        resolution.status === REFUND_STATUS.PENDING
      ) {
        return {
          refundId: latestFailed.id.toString(),
          refundNo: latestFailed.refundNo,
          outRefundNo: latestFailed.outRefundNo,
          status: resolution.status,
          recovered: true,
        };
      }

      const message = resolution.status === REFUND_STATUS.ABNORMAL
        ? '上一笔退款在微信侧处于异常状态，请先人工处理并同步退款状态，禁止重复发起'
        : '上一笔退款的微信侧状态尚未确认，请先同步退款状态，禁止重复发起';
      throw new BadRequestException(message);
    }

    return super.createRefund(params);
  }

  override async createGroupBuyFailureRefund(
    orderId: bigint | string,
    reason = '拼团失败自动退款',
  ): Promise<RefundResult> {
    const normalizedOrderId = BigInt(orderId);
    const existingRefund = await this.recoveryPrisma.orderRefund.findFirst({
      where: {
        orderId: normalizedOrderId,
        aftersaleId: null,
        reason: { startsWith: '拼团失败' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingRefund) {
      return super.createGroupBuyFailureRefund(normalizedOrderId, reason);
    }

    if (
      existingRefund.status === REFUND_STATUS.SUCCESS ||
      existingRefund.status === REFUND_STATUS.INITIATING ||
      existingRefund.status === REFUND_STATUS.PENDING ||
      existingRefund.status === REFUND_STATUS.PROCESSING
    ) {
      return super.createGroupBuyFailureRefund(normalizedOrderId, reason);
    }

    if (existingRefund.status === REFUND_STATUS.FAILED) {
      const resolution = await this.resolveUncertainFailedRefund(existingRefund);
      if (!resolution.retryable) {
        return {
          status: resolution.status,
          refundId: existingRefund.id.toString(),
          refundNo: existingRefund.refundNo,
          outRefundNo: existingRefund.outRefundNo,
        };
      }
    } else if (existingRefund.status !== REFUND_STATUS.CLOSED) {
      return {
        status: existingRefund.status,
        refundId: existingRefund.id.toString(),
        refundNo: existingRefund.refundNo,
        outRefundNo: existingRefund.outRefundNo,
      };
    }

    await (this.recoveryBenefitPackageService as any).restoreAfterRefundClosed?.(
      normalizedOrderId,
      null,
    );

    return this.retryDefinitiveFailedGroupRefund(normalizedOrderId, reason);
  }

  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    try {
      await super.processWechatRefundSuccess(refund, refundId, wechatData);
      const currentRefund = await this.recoveryPrisma.orderRefund.findUnique({
        where: { id: refund.id },
      });
      if (!currentRefund || currentRefund.status !== REFUND_STATUS.SUCCESS) return;

      const task = await this.ensureRefundSideEffectTask(currentRefund);
      try {
        await (this.recoveryShareService as any).reverseFirstPaidAttributionAfterRefund?.(
          currentRefund.orderId,
          currentRefund.id,
        );
        await this.resolveRefundSideEffectTask(task.id);
      } catch (error) {
        await this.markSideEffectTaskFailed(task.id, error);
        throw error;
      }
    } catch (error) {
      const currentRefund = await this.recoveryPrisma.orderRefund.findUnique({
        where: { id: refund.id },
      });
      if (currentRefund?.status === REFUND_STATUS.SUCCESS) {
        const task = await this.ensureRefundSideEffectTask(currentRefund);
        await this.markSideEffectTaskFailed(task.id, error);
      }
      throw error;
    }
  }

  async reconcilePaidOrderSideEffects(limit = 200) {
    const candidates = await this.recoveryPrisma.$queryRaw<Array<{
      id: bigint;
      orderNo: string;
      payAmount: number | null;
    }>>`
      SELECT
        o.id AS id,
        o.order_no AS orderNo,
        o.pay_amount AS payAmount
      FROM orders o
      WHERE o.status IN ('pending_delivery', 'pending_pickup', 'delivered', 'completed')
        AND NOT EXISTS (
          SELECT 1
          FROM payment_compensation_tasks t
          WHERE t.order_no = o.order_no
            AND t.reason = ${PAID_SIDE_EFFECT_REASON}
            AND t.transaction_id = CONCAT('paid-effects:', o.id)
        )
      ORDER BY o.id ASC
      LIMIT ${limit}
    `;

    if (candidates.length > 0) {
      await this.recoveryPrisma.paymentCompensationTask.createMany({
        data: candidates.map((order) => ({
          orderNo: order.orderNo,
          transactionId: `paid-effects:${order.id}`,
          amount: order.payAmount ?? 0,
          reason: PAID_SIDE_EFFECT_REASON,
          status: 'pending',
          callbackPayload: { orderId: order.id.toString() },
        })),
        skipDuplicates: true,
      });
    }

    const tasks = await this.recoveryPrisma.paymentCompensationTask.findMany({
      where: { reason: PAID_SIDE_EFFECT_REASON, status: 'pending' },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let resolved = 0;
    let failed = 0;
    let skipped = 0;
    for (const task of tasks) {
      const order = await this.recoveryPrisma.order.findFirst({
        where: { orderNo: task.orderNo },
        select: {
          id: true,
          userId: true,
          orderNo: true,
          payAmount: true,
          status: true,
        },
      });
      if (!order) {
        failed += 1;
        await this.markSideEffectTaskFailed(task.id, new Error('补偿任务对应订单不存在'));
        continue;
      }

      if (order.status === OrderStatus.cancelled) {
        await this.resolvePaidSideEffectTask(task.id, '订单已取消，无需补发支付成功副作用');
        resolved += 1;
        continue;
      }
      if (!PAID_EFFECT_ELIGIBLE_STATUSES.includes(order.status)) {
        skipped += 1;
        continue;
      }

      try {
        if ((order.payAmount ?? 0) > 0) {
          await this.recoveryShareService.processFirstPaidReward(
            order.userId.toString(),
            order.id.toString(),
            order.payAmount ?? 0,
          );
          const successfulRefunds = await this.recoveryPrisma.orderRefund.findMany({
            where: { orderId: order.id, status: REFUND_STATUS.SUCCESS },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
          for (const refund of successfulRefunds) {
            await (this.recoveryShareService as any).reverseFirstPaidAttributionAfterRefund?.(
              order.id,
              refund.id,
            );
          }
        }

        await (this.recoveryBenefitPackageService as any).reconcileOrderBenefits?.(
          order.id,
          order.userId,
        );
        await this.resolvePaidSideEffectTask(task.id, '首单归因与权益发放已完成并校验');
        resolved += 1;
      } catch (error) {
        failed += 1;
        await this.markSideEffectTaskFailed(task.id, error);
        this.recoveryLogger.error(
          `支付成功副作用补偿失败: orderId=${order.id}, error=${(error as Error).message}`,
        );
      }
    }

    return {
      seeded: candidates.length,
      total: tasks.length,
      resolved,
      failed,
      skipped,
    };
  }

  async reconcileRefundSuccessSideEffects(limit = 200) {
    const tasks = await this.recoveryPrisma.paymentCompensationTask.findMany({
      where: {
        reason: REFUND_SIDE_EFFECT_REASON,
        status: 'pending',
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let resolved = 0;
    let failed = 0;
    let skipped = 0;
    for (const task of tasks) {
      if (!task.transactionId) {
        skipped += 1;
        continue;
      }

      const refund = await this.recoveryPrisma.orderRefund.findFirst({
        where: { outRefundNo: task.transactionId },
      });
      if (!refund || refund.status !== REFUND_STATUS.SUCCESS) {
        skipped += 1;
        continue;
      }

      try {
        await super.processWechatRefundSuccess(
          refund,
          refund.refundId || '',
          refund.rawResponse || { amount: { refund: refund.refundAmount } },
        );
        await (this.recoveryShareService as any).reverseFirstPaidAttributionAfterRefund?.(
          refund.orderId,
          refund.id,
        );
        await this.resolveRefundSideEffectTask(task.id);
        resolved += 1;
      } catch (error) {
        failed += 1;
        await this.markSideEffectTaskFailed(task.id, error);
        this.recoveryLogger.error(
          `退款成功副作用补偿失败: refundId=${refund.id}, error=${(error as Error).message}`,
        );
      }
    }

    return { total: tasks.length, resolved, failed, skipped };
  }

  override async resolveCompensationTask(
    id: string,
    handledBy: string,
    resolution: string,
    status: 'resolved' | 'ignored',
  ) {
    const task = await this.recoveryPrisma.paymentCompensationTask.findFirst({
      where: { id: BigInt(id) },
      select: { reason: true },
    });
    if (
      task?.reason === REFUND_SIDE_EFFECT_REASON ||
      task?.reason === PAID_SIDE_EFFECT_REASON
    ) {
      throw new BadRequestException(
        '资金/权益一致性补偿任务不能人工忽略或标记完成，必须由自动补偿实际执行成功后关闭',
      );
    }
    return super.resolveCompensationTask(id, handledBy, resolution, status);
  }

  private async ensureRefundSideEffectTask(refund: any) {
    const order = await this.recoveryPrisma.order.findUnique({
      where: { id: refund.orderId },
      select: { orderNo: true },
    });
    if (!order) throw new InternalServerErrorException('退款对应订单不存在');

    await this.recoveryPrisma.paymentCompensationTask.createMany({
      data: [{
        orderNo: order.orderNo,
        transactionId: refund.outRefundNo,
        amount: refund.refundAmount,
        reason: REFUND_SIDE_EFFECT_REASON,
        status: 'pending',
        callbackPayload: {
          refundId: refund.id.toString(),
          outRefundNo: refund.outRefundNo,
        },
      }],
      skipDuplicates: true,
    });

    const task = await this.recoveryPrisma.paymentCompensationTask.findFirst({
      where: {
        orderNo: order.orderNo,
        reason: REFUND_SIDE_EFFECT_REASON,
        transactionId: refund.outRefundNo,
      },
    });
    if (!task) throw new InternalServerErrorException('退款副作用补偿任务创建失败');
    return task;
  }

  private async resolveRefundSideEffectTask(taskId: bigint) {
    await this.recoveryPrisma.paymentCompensationTask.updateMany({
      where: { id: taskId, status: 'pending' },
      data: {
        status: 'resolved',
        handledBy: 'system:refund-side-effect-reconcile',
        handledAt: new Date(),
        resolution: '退款成功后的权益、分佣、拼团与分享归因副作用已完成',
      },
    });
  }

  private async resolvePaidSideEffectTask(taskId: bigint, resolution: string) {
    await this.recoveryPrisma.paymentCompensationTask.updateMany({
      where: { id: taskId, status: 'pending' },
      data: {
        status: 'resolved',
        handledBy: 'system:paid-side-effect-reconcile',
        handledAt: new Date(),
        resolution,
      },
    });
  }

  private async markSideEffectTaskFailed(taskId: bigint, error: unknown) {
    await this.recoveryPrisma.paymentCompensationTask.updateMany({
      where: { id: taskId, status: 'pending' },
      data: {
        resolution: `自动补偿失败，等待重试：${(error as Error).message}`.slice(0, 4000),
      },
    });
  }

  private async resolveUncertainFailedRefund(refund: any): Promise<{
    retryable: boolean;
    status: string;
  }> {
    try {
      const wechatResult = await this.queryRefund(refund.outRefundNo);
      const wechatStatus = wechatResult?.status;

      if (wechatStatus === WECHAT_REFUND_STATUS.SUCCESS) {
        await this.processWechatRefundSuccess(
          refund,
          wechatResult.refund_id || refund.refundId || '',
          wechatResult,
        );
        return { retryable: false, status: REFUND_STATUS.SUCCESS };
      }

      if (wechatStatus === 'PROCESSING') {
        await this.recoveryPrisma.orderRefund.updateMany({
          where: { id: refund.id, status: REFUND_STATUS.FAILED },
          data: {
            status: REFUND_STATUS.PENDING,
            refundId: wechatResult.refund_id || refund.refundId,
            rawResponse: wechatResult,
          },
        });
        return { retryable: false, status: REFUND_STATUS.PENDING };
      }

      if (wechatStatus === WECHAT_REFUND_STATUS.CLOSED) {
        await this.recoveryPrisma.orderRefund.updateMany({
          where: { id: refund.id, status: REFUND_STATUS.FAILED },
          data: { status: REFUND_STATUS.CLOSED, rawResponse: wechatResult },
        });
        return { retryable: true, status: REFUND_STATUS.CLOSED };
      }

      if (wechatStatus === WECHAT_REFUND_STATUS.ABNORMAL) {
        await this.recoveryPrisma.orderRefund.updateMany({
          where: { id: refund.id, status: REFUND_STATUS.FAILED },
          data: { status: REFUND_STATUS.ABNORMAL, rawResponse: wechatResult },
        });
        return { retryable: false, status: REFUND_STATUS.ABNORMAL };
      }

      return { retryable: false, status: REFUND_STATUS.FAILED };
    } catch {
      return { retryable: false, status: REFUND_STATUS.FAILED };
    }
  }

  private async retryDefinitiveFailedGroupRefund(
    orderId: bigint,
    reason: string,
  ): Promise<RefundResult> {
    const member = await this.recoveryPrisma.groupBuyMember.findFirst({
      where: { orderId, deletedAt: null },
      select: { status: true, groupId: true },
    });
    if (!member) return { status: 'not_group_buy' };
    if (member.status !== 'paid') return { status: member.status };

    const group = await this.recoveryPrisma.groupBuyGroup.findFirst({
      where: { id: member.groupId, deletedAt: null },
      select: { status: true },
    });
    if (!group || (group.status !== 'failed' && group.status !== 'cancelled')) {
      return { status: 'group_not_failed' };
    }

    const order = await this.recoveryPrisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) throw new InternalServerErrorException('拼团订单不存在');
    if ((order.payAmount ?? 0) <= 0) {
      return super.createGroupBuyFailureRefund(orderId, reason);
    }
    if (!order.payment || order.payment.status !== PAYMENT_STATUS.SUCCESS) {
      return { status: 'not_paid' };
    }

    if (order.status !== OrderStatus.aftersale) {
      const retryableStatuses: OrderStatus[] = [
        OrderStatus.paid,
        OrderStatus.pending_delivery,
        OrderStatus.pending_pickup,
      ];
      if (!retryableStatuses.includes(order.status)) {
        throw new BadRequestException(`拼团退款重试时订单状态异常: ${order.status}`);
      }
      const claimed = await this.recoveryPrisma.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.aftersale },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('拼团退款重试时订单状态已变化');
      }
    }

    const result = await this.createRefund({
      orderId: orderId.toString(),
      refundAmount: order.payAmount!,
      reason: `${reason}（失败终态重试）`,
    });

    return { status: REFUND_STATUS.PENDING, ...result };
  }
}
