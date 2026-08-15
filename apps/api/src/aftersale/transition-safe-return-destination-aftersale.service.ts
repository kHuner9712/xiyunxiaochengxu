import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PaymentService } from '../payment/payment.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ReturnLogisticsDto } from './dto/return-logistics.dto';
import { ReturnDestinationViewAftersaleService } from './return-destination-view-aftersale.service';

@Injectable()
export class TransitionSafeReturnDestinationAftersaleService extends ReturnDestinationViewAftersaleService {
  constructor(
    private readonly transitionPrisma: PrismaService,
    paymentService: PaymentService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(transitionPrisma, paymentService, systemConfigService);
  }

  override async cancel(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const aftersaleId = parsePositiveBigIntId(id, '售后单');

    await this.transitionPrisma.$transaction(async (tx) => {
      const aftersale = await tx.aftersaleOrder.findFirst({
        where: { id: aftersaleId, userId: userIdValue },
        include: { order: true },
      });
      if (!aftersale) throw new NotFoundException('售后单不存在');

      const claimed = await tx.aftersaleOrder.updateMany({
        where: {
          id: aftersaleId,
          userId: userIdValue,
          status: AftersaleStatus.pending_review,
        },
        data: {
          status: AftersaleStatus.closed,
          activeOrderItemId: null,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('售后单状态已变化，请刷新后重试');
      }

      await tx.aftersaleLog.create({
        data: {
          aftersaleId,
          operatorType: 'user',
          operatorId: userIdValue,
          action: 'cancel',
          content: '用户取消售后申请',
        },
      });

      await this.restoreOrderWhenNoActiveAftersale(tx, aftersale.orderId, aftersale.order.completedAt);
    });

    return this.findUserDetail(userIdValue.toString(), aftersaleId.toString());
  }

  override async reject(id: string, adminId: string, rejectReason: string) {
    const aftersaleId = parsePositiveBigIntId(id, '售后单');
    const adminIdValue = parsePositiveBigIntId(adminId, '管理员');
    const normalizedReason = String(rejectReason || '').trim();
    if (!normalizedReason) throw new BadRequestException('请填写拒绝原因');

    await this.transitionPrisma.$transaction(async (tx) => {
      const aftersale = await tx.aftersaleOrder.findFirst({
        where: { id: aftersaleId },
        include: { order: true },
      });
      if (!aftersale) throw new NotFoundException('售后单不存在');

      const reviewedAt = new Date();
      const claimed = await tx.aftersaleOrder.updateMany({
        where: { id: aftersaleId, status: AftersaleStatus.pending_review },
        data: {
          status: AftersaleStatus.rejected,
          rejectReason: normalizedReason,
          adminId: adminIdValue,
          reviewedAt,
          activeOrderItemId: null,
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
          action: 'reject',
          content: `管理员拒绝售后：${normalizedReason}`,
        },
      });

      await this.restoreOrderWhenNoActiveAftersale(tx, aftersale.orderId, aftersale.order.completedAt);
    });

    return this.findAdminDetail(aftersaleId.toString());
  }

  override async fillReturnLogistics(userId: string, id: string, dto: ReturnLogisticsDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const aftersaleId = parsePositiveBigIntId(id, '售后单');

    // Keep the production return-destination requirement from the parent service, but perform the
    // approved -> returned transition atomically so a delayed duplicate request cannot overwrite a
    // concurrent refund transition back to `returned`.
    const detail = await this.findUserDetail(userIdValue.toString(), aftersaleId.toString());
    if (detail?.type !== 2) {
      throw new BadRequestException('仅退款类型不需要填写退货物流');
    }
    if (!String(detail.returnAddress || '').trim()) {
      throw new BadRequestException('退货地址尚未补齐，请先联系客服确认退货收件信息');
    }

    await this.transitionPrisma.$transaction(async (tx) => {
      const exists = await tx.aftersaleOrder.findFirst({
        where: { id: aftersaleId, userId: userIdValue },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('售后单不存在');

      const claimed = await tx.aftersaleOrder.updateMany({
        where: {
          id: aftersaleId,
          userId: userIdValue,
          type: 2,
          status: AftersaleStatus.approved,
        },
        data: {
          status: AftersaleStatus.returned,
          returnLogisticsCompany: dto.returnLogisticsCompany,
          returnLogisticsNo: dto.returnLogisticsNo,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('售后单状态已变化，请刷新后重试');
      }

      await tx.aftersaleLog.create({
        data: {
          aftersaleId,
          operatorType: 'user',
          operatorId: userIdValue,
          action: 'fill_return_logistics',
          content: [
            `用户填写退货物流，${dto.returnLogisticsCompany}：${dto.returnLogisticsNo}`,
            dto.contactPhone ? `联系电话：${dto.contactPhone}` : '',
            dto.remark ? `备注：${dto.remark}` : '',
          ].filter(Boolean).join('；'),
        },
      });
    });

    return this.findUserDetail(userIdValue.toString(), aftersaleId.toString());
  }

  private async restoreOrderWhenNoActiveAftersale(
    tx: any,
    orderId: bigint,
    completedAt: Date | null,
  ) {
    // Lock the order row while deciding whether its aggregate `aftersale` state can be restored.
    // A concurrent aftersale creation that later updates the same order will serialize behind this
    // lock and re-assert `aftersale`, preventing a stale restoration from becoming the final state.
    await tx.$queryRawUnsafe('SELECT id FROM orders WHERE id = ? FOR UPDATE', orderId);

    const otherAftersale = await tx.aftersaleOrder.findFirst({
      where: {
        orderId,
        status: {
          notIn: [
            AftersaleStatus.closed,
            AftersaleStatus.rejected,
            AftersaleStatus.refunded,
          ],
        },
      },
      select: { id: true },
    });
    if (otherAftersale) return;

    const restoreStatus = completedAt ? OrderStatus.completed : OrderStatus.delivered;
    await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.aftersale },
      data: { status: restoreStatus },
    });
  }
}
