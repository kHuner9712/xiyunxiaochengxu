import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { IdempotentGrowthAwareCouponService } from './idempotent-growth-aware-coupon.service';

const COUPON_CREATE_EVENT = 'coupon_create';
const COUPON_DELETE_EVENT = 'coupon_delete';
const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class DurableAdminCouponService extends IdempotentGrowthAwareCouponService {
  constructor(
    private readonly adminCouponPrisma: PrismaService,
    redis: RedisService,
  ) {
    super(adminCouponPrisma, redis);
  }

  override async create(dto: CreateCouponDto) {
    const data: any = (this as any).normalizeCreateInput(dto);
    (this as any).assertCouponFinalState(data);
    const applicableIds: string[] = (this as any).parseApplicableIds(data.applicableIds);
    const applicableType = Number(data.applicableType ?? 0);
    const requestId = dto.clientRequestId?.trim() || null;
    const fingerprint = this.createRequestFingerprint(data);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.adminCouponPrisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: COUPON_CREATE_EVENT,
                  bizType: 'coupon',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const payload = this.readCreateEventPayload(handled.payload);
                if (payload.fingerprint !== fingerprint) {
                  throw new BadRequestException('优惠券创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.coupon.findUnique({
                  where: { id: parsePositiveBigIntId(payload.couponId, '优惠券') },
                });
                if (!replay) {
                  throw new BadRequestException('该优惠券创建请求已处理，但优惠券记录不存在，请刷新列表后重试');
                }
                return { coupon: replay, replayed: true };
              }
            }

            await (this as any).assertApplicableTargetsExist(applicableType, applicableIds, tx);
            const coupon = await tx.coupon.create({ data });
            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: COUPON_CREATE_EVENT,
                  bizType: 'coupon',
                  bizId: requestId,
                  level: 'info',
                  message: '优惠券创建请求已处理',
                  payload: {
                    couponId: coupon.id.toString(),
                    fingerprint,
                  },
                },
              });
            }
            return { coupon, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );
        return (this as any).serializeCoupon(result.coupon);
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('优惠券创建事务重试次数已耗尽');
  }

  override async delete(id: string) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const result = await this.adminCouponPrisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE
      `;
      if (locked.length === 0) {
        const handled = await tx.businessEvent.findFirst({
          where: {
            eventType: COUPON_DELETE_EVENT,
            bizType: 'coupon',
            bizId: couponId.toString(),
          },
          orderBy: { id: 'desc' },
        });
        if (!handled) throw new NotFoundException('优惠券不存在');
        return {
          snapshot: this.readDeleteEventSnapshot(handled.payload, couponId),
          coupon: null,
          deleted: true,
        };
      }

      const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) throw new NotFoundException('优惠券不存在');
      const issuedCount = await tx.userCoupon.count({ where: { couponId } });
      if (issuedCount > 0) {
        const disabled = await tx.coupon.update({
          where: { id: couponId },
          data: { status: 0 },
        });
        return { coupon: disabled, snapshot: null, deleted: false };
      }

      const snapshot = this.jsonSafeCouponSnapshot(coupon);
      await tx.businessEvent.create({
        data: {
          eventType: COUPON_DELETE_EVENT,
          bizType: 'coupon',
          bizId: couponId.toString(),
          level: 'info',
          message: '优惠券硬删除已处理',
          payload: { coupon: snapshot },
        },
      });
      await tx.coupon.delete({ where: { id: couponId } });
      return { coupon: null, snapshot, deleted: true };
    });

    if (result.deleted) {
      return { ...result.snapshot, deleted: true };
    }
    return { ...(this as any).serializeCoupon(result.coupon), deleted: false };
  }

  private createRequestFingerprint(data: Record<string, any>) {
    const canonical = this.canonicalize(data);
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }
    return value;
  }

  private readCreateEventPayload(payload: unknown): { couponId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('优惠券创建请求记录异常，请刷新列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const couponId = typeof record.couponId === 'string' ? record.couponId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(couponId) || !fingerprint) {
      throw new BadRequestException('优惠券创建请求记录异常，请刷新列表后重试');
    }
    return { couponId, fingerprint };
  }

  private jsonSafeCouponSnapshot(coupon: any): Record<string, unknown> {
    return JSON.parse(JSON.stringify((this as any).serializeCoupon(coupon))) as Record<string, unknown>;
  }

  private readDeleteEventSnapshot(payload: unknown, couponId: bigint): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('优惠券删除记录异常，请刷新列表后重试');
    }
    const snapshot = (payload as Record<string, unknown>).coupon;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new BadRequestException('优惠券删除记录异常，请刷新列表后重试');
    }
    if (String((snapshot as Record<string, unknown>).id || '') !== couponId.toString()) {
      throw new BadRequestException('优惠券删除记录与请求不匹配，请联系管理员核查');
    }
    return snapshot as Record<string, unknown>;
  }
}
