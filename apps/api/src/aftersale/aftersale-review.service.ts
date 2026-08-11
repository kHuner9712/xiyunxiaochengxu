import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AftersaleStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';
import { AftersaleService } from './aftersale.service';
import { ApproveAftersaleDto } from './dto/approve-aftersale.dto';
import {
  RETURN_DESTINATION_ACTION,
  type ReturnDestinationSnapshot,
} from './return-destination';

@Injectable()
export class AftersaleReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aftersaleService: AftersaleService,
  ) {}

  async approve(id: string, adminId: string, dto: ApproveAftersaleDto) {
    const aftersaleId = parsePositiveBigIntId(id, '售后单');
    const adminIdValue = parsePositiveBigIntId(adminId, '管理员');
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: aftersaleId },
      include: {
        orderItem: true,
        order: {
          include: {
            orderItems: true,
            orderRefunds: true,
            aftersaleOrders: true,
          },
        },
      },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    if (aftersale.status !== AftersaleStatus.pending_review) {
      throw new BadRequestException('当前状态不允许审核');
    }

    const refundAmount = dto.refundAmount;
    const isZeroPay = (aftersale.order.payAmount ?? 0) === 0;
    const refundCap = calculateOrderItemRefundCap(aftersale.order, aftersale.orderItem, aftersale.id);
    if (isZeroPay) {
      if (!Number.isSafeInteger(refundAmount) || refundAmount !== 0) {
        throw new BadRequestException('0元订单退款金额必须为0分');
      }
      if (refundCap.remainingAmount !== 0) {
        throw new BadRequestException('0元订单退款金额分配异常，请先核对订单金额');
      }
    } else {
      if (!Number.isSafeInteger(refundAmount) || refundAmount <= 0) {
        throw new BadRequestException('退款金额必须大于0分');
      }
      if (refundAmount > refundCap.remainingAmount) {
        throw new BadRequestException(`退款金额不能超过剩余可退金额${refundCap.remainingAmount}分`);
      }
      if (aftersale.type === 2 && refundAmount !== refundCap.remainingAmount) {
        throw new BadRequestException(
          `当前售后模型不支持部分数量退货；退货退款必须一次退清该订单项剩余可退金额${refundCap.remainingAmount}分，避免退款金额与库存归还数量不一致`,
        );
      }
    }

    const destination = aftersale.type === 2 ? this.normalizeReturnDestination(dto) : null;

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.aftersaleOrder.updateMany({
        where: { id: aftersaleId, status: AftersaleStatus.pending_review },
        data: {
          status: AftersaleStatus.approved,
          refundAmount,
          adminId: adminIdValue,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('售后单状态已变化，请刷新后重试');
      }

      await tx.aftersaleLog.create({
        data: {
          aftersaleId,
          operatorType: 'admin',
          operatorId: adminIdValue,
          action: 'approve',
          content: isZeroPay
            ? '管理员审核通过，0元订单退款金额：0分'
            : `管理员同意售后，退款金额：${refundAmount}分`,
        },
      });
      if (destination) {
        await tx.aftersaleLog.create({
          data: {
            aftersaleId,
            operatorType: 'admin',
            operatorId: adminIdValue,
            action: RETURN_DESTINATION_ACTION,
            content: JSON.stringify(destination),
          },
        });
      }
    });

    return this.aftersaleService.findAdminDetail(aftersaleId.toString());
  }

  private normalizeReturnDestination(dto: ApproveAftersaleDto): ReturnDestinationSnapshot {
    const receiverName = String(dto.returnReceiverName || '').trim();
    const receiverPhone = String(dto.returnReceiverPhone || '').trim();
    const address = String(dto.returnAddress || '').trim();
    if (!receiverName) throw new BadRequestException('退货退款审核通过时必须填写退货收件人');
    if (!receiverPhone) throw new BadRequestException('退货退款审核通过时必须填写退货联系电话');
    if (!address) throw new BadRequestException('退货退款审核通过时必须填写退货地址');
    return { version: 1, receiverName, receiverPhone, address };
  }
}
