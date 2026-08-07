import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
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

interface RefundResult {
  status: string;
  refundId?: string;
  refundNo?: string;
  outRefundNo?: string;
}

@Injectable()
export class RecoverableProductionPaymentService extends ProductionPaymentService {
  constructor(
    private readonly recoveryPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
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
      shareService,
      recoveryBenefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
    );
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
    } else if (
      existingRefund.status !== REFUND_STATUS.CLOSED &&
      existingRefund.status !== REFUND_STATUS.ABNORMAL
    ) {
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

      if (wechatStatus === WECHAT_REFUND_STATUS.PROCESSING) {
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

      if (
        wechatStatus === WECHAT_REFUND_STATUS.CLOSED ||
        wechatStatus === WECHAT_REFUND_STATUS.ABNORMAL
      ) {
        const localStatus =
          wechatStatus === WECHAT_REFUND_STATUS.CLOSED
            ? REFUND_STATUS.CLOSED
            : REFUND_STATUS.ABNORMAL;
        await this.recoveryPrisma.orderRefund.updateMany({
          where: { id: refund.id, status: REFUND_STATUS.FAILED },
          data: { status: localStatus, rawResponse: wechatResult },
        });
        return { retryable: true, status: localStatus };
      }

      return { retryable: false, status: REFUND_STATUS.FAILED };
    } catch {
      // FAILED can represent a network timeout after WeChat accepted the request.
      // If the old outRefundNo cannot be authoritatively resolved, never submit a second refund.
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
