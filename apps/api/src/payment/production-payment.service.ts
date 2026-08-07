import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import {
  COUPON_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from '../common/constants';
import { OrderService } from '../order/order.service';
import { assertOrderTransition } from '../order/order-state-machine';
import { ShareService } from '../share/share.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { PaymentService } from './payment.service';

interface GroupBuyPaymentOutcome {
  isGroupBuy: boolean;
  state?: 'waiting' | 'success' | 'refund_required' | 'already_refunded';
  releasedOrderIds?: string[];
  reason?: string;
}

@Injectable()
export class ProductionPaymentService extends PaymentService {
  private readonly productionLogger = new Logger(ProductionPaymentService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    configService: ConfigService,
    private readonly productionBusinessEvent: BusinessEventService,
    private readonly productionOrderService: OrderService,
    private readonly productionShareService: ShareService,
    private readonly productionBenefitPackageService: BenefitPackageService,
    private readonly productionMerchantSettlementService: MerchantSettlementService,
    private readonly productionGroupBuyService: GroupBuyService,
    private readonly productionFlashSaleService: FlashSaleService,
  ) {
    super(
      productionPrisma,
      configService,
      productionBusinessEvent,
      productionOrderService,
      productionShareService,
      productionBenefitPackageService,
      productionMerchantSettlementService,
      productionGroupBuyService,
      productionFlashSaleService,
    );
  }

  override async processPaymentSuccess(
    paymentId: bigint,
    orderId: bigint,
    transactionId: string,
    totalAmount: number | null | undefined,
    order: any,
  ) {
    const paymentResult = await this.productionPrisma.$transaction(async (tx) => {
      const existingPayment = await tx.orderPayment.findUnique({ where: { id: paymentId } });
      if (!existingPayment) {
        throw new InternalServerErrorException('支付记录不存在');
      }

      const groupMember = await tx.groupBuyMember.findFirst({
        where: { orderId, deletedAt: null },
        select: { id: true },
      });
      const isGroupBuy = !!groupMember;
      const targetStatus = isGroupBuy
        ? OrderStatus.paid
        : order.fulfillmentType === 'pickup'
          ? OrderStatus.pending_pickup
          : OrderStatus.pending_delivery;

      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) {
        throw new InternalServerErrorException('订单不存在');
      }

      if (existingPayment.status === PAYMENT_STATUS.SUCCESS) {
        if (existingPayment.transactionId && existingPayment.transactionId !== transactionId) {
          throw new BadRequestException('支付交易号不一致');
        }

        const alreadyProcessed = new Set<OrderStatus>([
          OrderStatus.paid,
          OrderStatus.pending_delivery,
          OrderStatus.pending_pickup,
          OrderStatus.delivered,
          OrderStatus.completed,
          OrderStatus.aftersale,
          OrderStatus.cancelled,
        ]);
        if (alreadyProcessed.has(currentOrder.status)) {
          return { isGroupBuy, newlyPaid: false };
        }

        if (currentOrder.status !== OrderStatus.pending_payment) {
          throw new BadRequestException('订单状态异常');
        }

        const updated = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.pending_payment },
          data: { status: targetStatus, paidAt: new Date() },
        });
        if (updated.count === 0) {
          throw new BadRequestException('订单状态已变更，支付补偿失败');
        }

        if (targetStatus === OrderStatus.pending_pickup) {
          await this.productionOrderService.assignUniquePickupCode(tx, orderId);
        }
        assertOrderTransition(OrderStatus.pending_payment, targetStatus, '支付成功补偿');
        await this.markCouponUsed(tx, order.couponId);
        await tx.orderLog.create({
          data: {
            orderId,
            operatorType: 'system',
            action: 'payment_reconcile_fix',
            content: isGroupBuy
              ? `支付成功补偿：订单进入已付款待成团，交易号：${transactionId}`
              : `支付成功补偿：订单进入${targetStatus}，交易号：${transactionId}`,
          },
        });
        return { isGroupBuy, newlyPaid: true };
      }

      if (currentOrder.status === OrderStatus.cancelled) {
        this.productionBusinessEvent.emitCritical(
          'payment_success_on_cancelled_order',
          'payment',
          `支付成功但订单已取消: 订单${orderId}，交易号${transactionId}`,
          orderId.toString(),
          { orderId: orderId.toString(), transactionId },
        );
        throw new BadRequestException('订单已取消，支付成功需补偿');
      }

      if (currentOrder.status !== OrderStatus.pending_payment) {
        if (
          currentOrder.status === targetStatus ||
          (isGroupBuy && currentOrder.status === OrderStatus.aftersale)
        ) {
          return { isGroupBuy, newlyPaid: false };
        }
        throw new BadRequestException(`订单状态异常: ${currentOrder.status}`);
      }

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.pending_payment },
        data: { status: targetStatus, paidAt: new Date() },
      });
      if (updated.count === 0) {
        throw new BadRequestException('订单状态已变更，支付处理失败');
      }

      if (targetStatus === OrderStatus.pending_pickup) {
        await this.productionOrderService.assignUniquePickupCode(tx, orderId);
      }
      assertOrderTransition(OrderStatus.pending_payment, targetStatus, '支付成功');

      await tx.orderPayment.update({
        where: { id: paymentId },
        data: {
          transactionId,
          status: PAYMENT_STATUS.SUCCESS,
          paidAt: new Date(),
          rawResponse: { totalAmount, transactionId },
        },
      });

      await tx.orderLog.create({
        data: {
          orderId,
          operatorType: 'system',
          action: 'pay',
          content: isGroupBuy
            ? `微信支付成功，订单进入已付款待成团，交易号：${transactionId}`
            : `微信支付成功，交易号：${transactionId}`,
        },
      });
      await this.markCouponUsed(tx, order.couponId);
      return { isGroupBuy, newlyPaid: true };
    });

    if (paymentResult.isGroupBuy) {
      const outcome = (await this.productionGroupBuyService.handlePaymentSuccess(
        orderId,
      )) as unknown as GroupBuyPaymentOutcome;

      if (outcome?.state === 'refund_required') {
        await this.createGroupBuyFailureRefund(orderId, outcome.reason || '拼团失败自动退款');
        return;
      }

      if (outcome?.state === 'success') {
        const orderIds = outcome.releasedOrderIds?.length
          ? outcome.releasedOrderIds
          : [orderId.toString()];
        for (const releasedOrderId of orderIds) {
          await this.processPaidOrderEffects(releasedOrderId);
        }
      }
      return;
    }

    if (paymentResult.newlyPaid) {
      await this.processPaidOrderEffects(orderId.toString());
    }

    try {
      await this.productionFlashSaleService.handlePaymentSuccess(orderId);
    } catch (error) {
      this.productionLogger.error(
        `秒杀成交处理失败: orderId=${orderId}`,
        (error as Error).message,
      );
      throw error;
    }
  }

  async createGroupBuyFailureRefund(
    orderId: bigint | string,
    reason = '拼团失败自动退款',
  ): Promise<{ status: string; refundId?: string; refundNo?: string; outRefundNo?: string }> {
    const normalizedOrderId = BigInt(orderId);
    const member = await this.productionPrisma.groupBuyMember.findFirst({
      where: { orderId: normalizedOrderId, deletedAt: null },
      select: { id: true, status: true, groupId: true },
    });
    if (!member) return { status: 'not_group_buy' };

    const group = await this.productionPrisma.groupBuyGroup.findFirst({
      where: { id: member.groupId, deletedAt: null },
      select: { status: true },
    });
    if (!group || (group.status !== 'failed' && group.status !== 'cancelled')) {
      return { status: 'group_not_failed' };
    }

    const order = await this.productionPrisma.order.findUnique({
      where: { id: normalizedOrderId },
      include: { payment: true },
    });
    if (!order) throw new InternalServerErrorException('拼团订单不存在');

    if ((order.payAmount ?? 0) <= 0) {
      await (this.productionGroupBuyService as any).handleRefundSuccess(normalizedOrderId);
      return { status: 'zero_pay_reverted' };
    }

    if (!order.payment || order.payment.status !== PAYMENT_STATUS.SUCCESS) {
      return { status: 'not_paid' };
    }

    const existingRefund = await this.productionPrisma.orderRefund.findFirst({
      where: {
        orderId: normalizedOrderId,
        aftersaleId: null,
        reason: { startsWith: '拼团失败' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingRefund) {
      if (existingRefund.status === REFUND_STATUS.SUCCESS) {
        await (this.productionGroupBuyService as any).handleRefundSuccess(normalizedOrderId);
      }
      return {
        status: existingRefund.status,
        refundId: existingRefund.id.toString(),
        refundNo: existingRefund.refundNo,
        outRefundNo: existingRefund.outRefundNo,
      };
    }

    const protectedStatuses: OrderStatus[] = [
      OrderStatus.paid,
      OrderStatus.pending_delivery,
      OrderStatus.pending_pickup,
    ];
    if (protectedStatuses.includes(order.status)) {
      await this.productionPrisma.order.updateMany({
        where: { id: normalizedOrderId, status: order.status },
        data: { status: OrderStatus.aftersale },
      });
      await this.productionPrisma.orderLog.create({
        data: {
          orderId: normalizedOrderId,
          operatorType: 'system',
          action: 'group_buy_refund',
          content: '拼团失败，系统自动发起全额退款',
        },
      });
    }

    try {
      const result = await super.createRefund({
        orderId: normalizedOrderId.toString(),
        refundAmount: order.payAmount!,
        reason,
      });
      return { status: 'pending', ...result };
    } catch (error) {
      const latestRefund = await this.productionPrisma.orderRefund.findFirst({
        where: {
          orderId: normalizedOrderId,
          aftersaleId: null,
          reason: { startsWith: '拼团失败' },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!latestRefund) {
        await this.productionPrisma.order.updateMany({
          where: { id: normalizedOrderId, status: OrderStatus.aftersale },
          data: { status: OrderStatus.paid },
        });
      }
      throw error;
    }
  }

  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    await super.processWechatRefundSuccess(refund, refundId, wechatData);
    try {
      await (this.productionGroupBuyService as any).handleRefundSuccess(refund.orderId);
    } catch (error) {
      this.productionLogger.error(
        `拼团退款成功后的订单补偿失败: orderId=${refund.orderId}`,
        (error as Error).message,
      );
      throw error;
    }
  }

  private async markCouponUsed(tx: Prisma.TransactionClient, couponId?: bigint | null) {
    if (!couponId) return;
    const coupon = await tx.userCoupon.findFirst({ where: { id: couponId } });
    if (!coupon) return;
    if (coupon.status === COUPON_STATUS.LOCKED) {
      await tx.userCoupon.update({
        where: { id: couponId },
        data: { status: COUPON_STATUS.USED, usedAt: new Date() },
      });
      return;
    }
    if (coupon.status !== COUPON_STATUS.USED) {
      this.productionBusinessEvent.emitWarn(
        'coupon_status_abnormal',
        'coupon',
        `支付成功时优惠券状态异常(${coupon.status})`,
        couponId.toString(),
        { couponId: couponId.toString(), status: coupon.status },
      );
    }
  }

  private async processPaidOrderEffects(orderId: string): Promise<void> {
    const order = await this.productionPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      select: {
        id: true,
        userId: true,
        payAmount: true,
        sourceType: true,
        sourceCode: true,
      },
    });
    if (!order) return;

    if ((order.payAmount ?? 0) > 0) {
      try {
        await this.productionShareService.processFirstPaidReward(
          order.userId.toString(),
          order.id.toString(),
          order.payAmount || 0,
        );
      } catch (error) {
        this.productionLogger.error(
          `首单邀请奖励处理失败: orderId=${order.id}`,
          (error as Error).message,
        );
      }
    }

    try {
      await this.productionBenefitPackageService.grantBenefitsForOrder(
        order.id,
        order.userId,
      );
    } catch (error) {
      this.productionLogger.error(
        `权益卡发放失败: orderId=${order.id}`,
        (error as Error).message,
      );
    }

    if ((order.payAmount ?? 0) > 0) {
      try {
        await this.productionMerchantSettlementService.generateSalesCommission(
          order.id,
          order.userId,
          order.payAmount || 0,
          order.sourceType,
          order.sourceCode || '',
        );
      } catch (error) {
        this.productionLogger.error(
          `销售分佣生成失败: orderId=${order.id}`,
          (error as Error).message,
        );
      }
    }
  }
}
