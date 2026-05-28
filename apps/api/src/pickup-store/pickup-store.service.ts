import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class PickupStoreService {
  private readonly logger = new Logger(PickupStoreService.name);

  constructor(private prisma: PrismaService) {}

  async findPublished(page: number, pageSize: number) {
    const where = { status: 1, deletedAt: null };
    const [list, total] = await Promise.all([
      this.prisma.pickupStore.findMany({
        where, orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.pickupStore.count({ where }),
    ]);
    return paginate(list.map((s) => this.serialize(s)), total, page, pageSize);
  }

  async findById(id: string) {
    const store = await this.prisma.pickupStore.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!store) throw new NotFoundException('自提点不存在');
    return this.serialize(store);
  }

  async findAllAdmin(page: number, pageSize: number, keyword?: string, status?: number) {
    const where: any = { deletedAt: null };
    if (keyword) where.name = { contains: keyword };
    if (status !== undefined) where.status = status;
    const [list, total] = await Promise.all([
      this.prisma.pickupStore.findMany({
        where, orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.pickupStore.count({ where }),
    ]);
    return paginate(list.map((s) => this.serialize(s)), total, page, pageSize);
  }

  async create(data: any) {
    const store = await this.prisma.pickupStore.create({
      data: {
        name: data.name,
        contactPhone: data.contactPhone,
        province: data.province,
        city: data.city,
        district: data.district,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        businessHours: data.businessHours,
        pickupNotice: data.pickupNotice,
        status: data.status ?? 1,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    this.logger.log(`创建自提点：${store.id}`);
    return this.serialize(store);
  }

  async update(id: string, data: any) {
    const store = await this.prisma.pickupStore.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!store) throw new NotFoundException('自提点不存在');
    const updateData: any = {};
    const fields = ['name', 'contactPhone', 'province', 'city', 'district', 'address', 'latitude', 'longitude', 'businessHours', 'pickupNotice', 'status', 'sortOrder'];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    const result = await this.prisma.pickupStore.update({ where: { id: BigInt(id) }, data: updateData });
    this.logger.log(`更新自提点：${id}`);
    return this.serialize(result);
  }

  async delete(id: string) {
    const store = await this.prisma.pickupStore.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!store) throw new NotFoundException('自提点不存在');
    const result = await this.prisma.pickupStore.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除自提点：${id}`);
    return this.serialize(result);
  }

  async updateStatus(id: string, status: number) {
    const store = await this.prisma.pickupStore.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!store) throw new NotFoundException('自提点不存在');
    const result = await this.prisma.pickupStore.update({
      where: { id: BigInt(id) },
      data: { status },
    });
    this.logger.log(`更新自提点状态：${id} -> ${status}`);
    return this.serialize(result);
  }

  async verifyPickupCode(pickupCode: string, verifiedBy: string) {
    const order = await this.prisma.order.findFirst({
      where: { pickupCode },
    });
    if (!order) throw new NotFoundException('自提码不存在');
    if (order.fulfillmentType !== 'pickup') {
      throw new BadRequestException('该订单不是自提订单');
    }
    if (order.status !== 'pending_pickup') {
      throw new BadRequestException(`订单状态不允许核销，当前状态：${order.status}`);
    }
    if (order.pickedUpAt) {
      throw new BadRequestException('该订单已核销，请勿重复核销');
    }

    const { assertOrderTransition } = await import('./../order/order-state-machine');
    assertOrderTransition(order.status as any, 'completed' as any, 'pickup_verify');

    const pickedUpAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'pending_pickup',
          pickedUpAt: null,
        },
        data: {
          status: 'completed',
          pickedUpAt,
          pickupVerifiedBy: BigInt(verifiedBy),
        },
      });

      if (updated.count === 0) {
        const latest = await tx.order.findFirst({ where: { id: order.id } });
        if (!latest) {
          throw new NotFoundException('订单不存在');
        }
        throw new BadRequestException('该订单已核销或订单状态已变化');
      }

      await tx.orderLog.create({
        data: {
          orderId: order.id,
          action: 'pickup_verify',
          operatorType: 'admin',
          operatorId: BigInt(verifiedBy),
          content: `自提核销，自提码：${pickupCode}`,
        },
      });

      return tx.order.findFirst({ where: { id: order.id } });
    });

    this.logger.log(`自提核销成功：订单${order.id}，自提码${pickupCode}`);
    return {
      success: true,
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      pickedUpAt: result?.pickedUpAt ?? pickedUpAt,
    };
  }

  private serialize(store: any) {
    return {
      id: store.id.toString(),
      name: store.name,
      contactPhone: store.contactPhone,
      province: store.province,
      city: store.city,
      district: store.district,
      address: store.address,
      fullAddress: `${store.province}${store.city}${store.district}${store.address}`,
      latitude: store.latitude,
      longitude: store.longitude,
      businessHours: store.businessHours,
      pickupNotice: store.pickupNotice,
      status: store.status,
      sortOrder: store.sortOrder,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}
