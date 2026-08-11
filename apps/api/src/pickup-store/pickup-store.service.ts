import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { paginate } from '@baby-mall/shared';
import { OrderService } from '../order/order.service';

@Injectable()
export class PickupStoreService {
  private readonly logger = new Logger(PickupStoreService.name);

  constructor(private prisma: PrismaService, private orderService: OrderService) {}

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
    const storeId = parsePositiveBigIntId(id, '自提点');
    const store = await this.prisma.pickupStore.findFirst({
      where: { id: storeId, deletedAt: null },
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
    this.assertCoordinatePair(data.latitude, data.longitude);
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
    const storeId = parsePositiveBigIntId(id, '自提点');
    const store = await this.prisma.pickupStore.findFirst({ where: { id: storeId, deletedAt: null } });
    if (!store) throw new NotFoundException('自提点不存在');
    const nextLatitude = data.latitude !== undefined ? data.latitude : store.latitude;
    const nextLongitude = data.longitude !== undefined ? data.longitude : store.longitude;
    this.assertCoordinatePair(nextLatitude, nextLongitude);
    const updateData: any = {};
    const fields = ['name', 'contactPhone', 'province', 'city', 'district', 'address', 'latitude', 'longitude', 'businessHours', 'pickupNotice', 'status', 'sortOrder'];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    const result = await this.prisma.pickupStore.update({ where: { id: storeId }, data: updateData });
    this.logger.log(`更新自提点：${id}`);
    return this.serialize(result);
  }

  async delete(id: string) {
    const storeId = parsePositiveBigIntId(id, '自提点');
    const store = await this.prisma.pickupStore.findFirst({ where: { id: storeId, deletedAt: null } });
    if (!store) throw new NotFoundException('自提点不存在');
    const activeOrders = await this.prisma.order.count({
      where: {
        pickupStoreId: storeId,
        status: { in: ['pending_payment', 'paid', 'pending_pickup', 'aftersale'] },
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException('该自提点仍有未完成订单，请先停用并处理完成后再删除');
    }
    const result = await this.prisma.pickupStore.update({
      where: { id: storeId },
      data: { status: 0, deletedAt: new Date() },
    });
    this.logger.log(`删除自提点：${id}`);
    return this.serialize(result);
  }

  async updateStatus(id: string, status: number) {
    const storeId = parsePositiveBigIntId(id, '自提点');
    const store = await this.prisma.pickupStore.findFirst({ where: { id: storeId, deletedAt: null } });
    if (!store) throw new NotFoundException('自提点不存在');
    const result = await this.prisma.pickupStore.update({
      where: { id: storeId },
      data: { status },
    });
    this.logger.log(`更新自提点状态：${id} -> ${status}`);
    return this.serialize(result);
  }

  async verifyPickupCode(pickupCode: string, verifiedBy: string) {
    const adminId = parsePositiveBigIntId(verifiedBy, '管理员').toString();
    const result = await this.orderService.completePickupOrderByCode(pickupCode.trim(), adminId);
    this.logger.log(`自提核销成功：订单${result.orderId}，自提码${pickupCode}`);
    return result;
  }

  async previewPickupOrder(pickupCode: string) {
    return this.orderService.findPickupOrderByCode(pickupCode.trim());
  }

  private assertCoordinatePair(latitude: unknown, longitude: unknown) {
    const hasLatitude = latitude !== null && latitude !== undefined;
    const hasLongitude = longitude !== null && longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('经纬度必须同时填写或同时留空');
    }
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
