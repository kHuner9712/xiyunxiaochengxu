import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { paginate } from '@baby-mall/shared';
import { OrderService } from '../order/order.service';
import { CreatePickupStoreDto, UpdatePickupStoreDto } from './dto/pickup-store.dto';

const PICKUP_STORE_CREATE_EVENT = 'pickup_store_create';
const SERIALIZABLE_RETRY_LIMIT = 3;

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

  async create(data: CreatePickupStoreDto) {
    this.assertCoordinatePair(data.latitude, data.longitude);
    const requestId = data.clientRequestId?.trim() || null;
    const createData = {
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
    };
    const fingerprint = this.createRequestFingerprint(createData);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: PICKUP_STORE_CREATE_EVENT,
                  bizType: 'pickup_store',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const payload = this.readCreateEventPayload(handled.payload);
                if (payload.fingerprint !== fingerprint) {
                  throw new BadRequestException('自提点创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.pickupStore.findFirst({
                  where: { id: parsePositiveBigIntId(payload.storeId, '自提点') },
                });
                if (!replay) {
                  throw new BadRequestException('该自提点创建请求已处理，但门店记录不存在，请刷新列表后重试');
                }
                if (replay.deletedAt) {
                  throw new BadRequestException('该自提点创建请求已处理，但门店已删除，请刷新列表');
                }
                return { store: replay, replayed: true };
              }
            }

            const store = await tx.pickupStore.create({ data: createData });
            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: PICKUP_STORE_CREATE_EVENT,
                  bizType: 'pickup_store',
                  bizId: requestId,
                  level: 'info',
                  message: '自提点创建请求已处理',
                  payload: { storeId: store.id.toString(), fingerprint },
                },
              });
            }
            return { store, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );
        this.logger.log(`创建自提点：${result.store.id}${result.replayed ? '（幂等重放）' : ''}`);
        return this.serialize(result.store);
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('自提点创建事务重试次数已耗尽');
  }

  async update(id: string, data: UpdatePickupStoreDto) {
    const storeId = parsePositiveBigIntId(id, '自提点');
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM pickup_stores WHERE id = ${storeId} AND deleted_at IS NULL FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('自提点不存在');

      const store = await tx.pickupStore.findUnique({ where: { id: storeId } });
      if (!store || store.deletedAt) throw new NotFoundException('自提点不存在');
      const nextLatitude = data.latitude !== undefined ? data.latitude : store.latitude;
      const nextLongitude = data.longitude !== undefined ? data.longitude : store.longitude;
      this.assertCoordinatePair(nextLatitude, nextLongitude);
      const updateData: any = {};
      const fields = ['name', 'contactPhone', 'province', 'city', 'district', 'address', 'latitude', 'longitude', 'businessHours', 'pickupNotice', 'status', 'sortOrder'];
      for (const field of fields) {
        if ((data as any)[field] !== undefined) updateData[field] = (data as any)[field];
      }
      return tx.pickupStore.update({ where: { id: storeId }, data: updateData });
    });
    this.logger.log(`更新自提点：${id}`);
    return this.serialize(result);
  }

  async delete(id: string) {
    const storeId = parsePositiveBigIntId(id, '自提点');
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM pickup_stores
        WHERE id = ${storeId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('自提点不存在');

      const store = await tx.pickupStore.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException('自提点不存在');
      if (store.deletedAt) return { store, replayed: true };

      const activeOrders = await tx.order.count({
        where: {
          pickupStoreId: storeId,
          status: { in: ['pending_payment', 'paid', 'pending_pickup', 'aftersale'] },
        },
      });
      if (activeOrders > 0) {
        throw new BadRequestException('该自提点仍有未完成订单，请先停用并处理完成后再删除');
      }

      const deleted = await tx.pickupStore.update({
        where: { id: storeId },
        data: { status: 0, deletedAt: new Date() },
      });
      return { store: deleted, replayed: false };
    });
    this.logger.log(`删除自提点：${id}${result.replayed ? '（幂等重放）' : ''}`);
    return this.serialize(result.store);
  }

  async updateStatus(id: string, status: number) {
    const storeId = parsePositiveBigIntId(id, '自提点');
    const updated = await this.prisma.pickupStore.updateMany({
      where: { id: storeId, deletedAt: null },
      data: { status },
    });
    if (updated.count === 0) throw new NotFoundException('自提点不存在');
    const result = await this.prisma.pickupStore.findFirst({
      where: { id: storeId, deletedAt: null },
    });
    if (!result) throw new NotFoundException('自提点不存在');
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

  private createRequestFingerprint(data: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private readCreateEventPayload(payload: unknown): { storeId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('自提点创建请求记录异常，请刷新列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const storeId = typeof record.storeId === 'string' ? record.storeId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(storeId) || !fingerprint) {
      throw new BadRequestException('自提点创建请求记录异常，请刷新列表后重试');
    }
    return { storeId, fingerprint };
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
