import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { TransactionalOrderService } from './transactional-order.service';

@Injectable()
export class ProductionOrderService extends TransactionalOrderService {
  constructor(
    private readonly productionPrisma: PrismaService,
    businessEvent: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    @Inject(forwardRef(() => GroupBuyService))
    groupBuyService: GroupBuyService,
    @Inject(forwardRef(() => FlashSaleService))
    flashSaleService: FlashSaleService,
  ) {
    super(
      productionPrisma,
      businessEvent,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
    );
  }

  override async getOrderCountByUser(userId: string) {
    const where = { userId: BigInt(userId) };
    const [unpaid, paid, unshipped, pendingPickup, unreceived, aftersale] = await Promise.all([
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_payment } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.paid } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_delivery } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_pickup } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.aftersale } }),
    ]);

    return { unpaid, paid, unshipped, pendingPickup, unreceived, aftersale };
  }

  override async findByUser(userId: string, dto: OrderQueryDto) {
    const result: any = await super.findByUser(userId, dto);
    const list = Array.isArray(result?.list) ? result.list : [];
    return {
      ...result,
      list: await this.attachGroupBuyContext(list),
    };
  }

  override async findById(userId: string, id: string) {
    const result: any = await super.findById(userId, id);
    const [view] = await this.attachGroupBuyContext([result]);
    return view;
  }

  override async findByOrderNo(userId: string, orderNo: string) {
    const result: any = await super.findByOrderNo(userId, orderNo);
    const [view] = await this.attachGroupBuyContext([result]);
    return view;
  }

  private async attachGroupBuyContext<T extends { id?: string | number | bigint }>(
    views: T[],
  ): Promise<Array<T & { groupBuyGroupId?: string }>> {
    const orderIds = views
      .map((view) => view?.id)
      .filter((id): id is string | number | bigint => id !== undefined && id !== null && id !== '')
      .map((id) => BigInt(id));
    if (orderIds.length === 0) return views;

    const members = await this.productionPrisma.groupBuyMember.findMany({
      where: {
        orderId: { in: orderIds },
        deletedAt: null,
      },
      select: { orderId: true, groupId: true },
    });
    const groupByOrder = new Map(
      members.map((member) => [member.orderId.toString(), member.groupId.toString()]),
    );

    return views.map((view) => {
      const id = view.id?.toString();
      const groupBuyGroupId = id ? groupByOrder.get(id) : undefined;
      return groupBuyGroupId ? { ...view, groupBuyGroupId } : view;
    });
  }
}
