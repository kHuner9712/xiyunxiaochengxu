import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { COUPON_STATUS } from '../common/constants/payment';

export type LockedPickupStore = {
  id: bigint;
  name: string;
  province: string;
  city: string;
  district: string;
  address: string;
  contactPhone: string;
};

export async function lockActiveCheckoutUser(
  tx: Prisma.TransactionClient,
  userId: bigint,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM users
    WHERE id = ${userId}
      AND status = 1
      AND deleted_at IS NULL
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new UnauthorizedException('账号已停用或注销，请重新登录');
  }
}

/**
 * Checkout is an asset-consumption boundary. The background points-expiry job runs every ten
 * minutes, so a point lot can be past expire_at while still being included in users.available_points.
 * Settle those overdue lots while the caller owns the user row lock before any order can consume
 * points. The algorithm matches ProductionPointsService FIFO accounting and writes the same
 * source/sourceId expiry marker, making scheduler/checkout races idempotent.
 */
export async function settleExpiredPointsBeforeCheckout(
  tx: Prisma.TransactionClient,
  userId: bigint,
  now = new Date(),
): Promise<{ processed: number; deducted: number }> {
  let processed = 0;
  let deducted = 0;
  const maxLotsPerCheckout = 1000;

  while (processed < maxLotsPerCheckout) {
    const candidates = await tx.$queryRaw<Array<{
      id: bigint;
      points: number;
      createdAt: Date;
    }>>`
      SELECT r.id AS id, r.points AS points, r.created_at AS createdAt
      FROM points_records r
      WHERE r.user_id = ${userId}
        AND r.type = 1
        AND r.expire_at IS NOT NULL
        AND r.expire_at <= ${now}
        AND NOT EXISTS (
          SELECT 1
          FROM points_records marker
          WHERE marker.source IN ('expire', 'expire_marker')
            AND marker.source_id = r.id
        )
      ORDER BY r.expire_at ASC, r.id ASC
      LIMIT 100
    `;
    if (candidates.length === 0) return { processed, deducted };

    for (const candidate of candidates) {
      await tx.$queryRaw`SELECT id FROM points_records WHERE id = ${candidate.id} FOR UPDATE`;
      const marker = await tx.pointsRecord.findFirst({
        where: {
          source: { in: ['expire', 'expire_marker'] },
          sourceId: candidate.id,
        },
        select: { id: true },
      });
      if (marker) continue;

      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { availablePoints: true },
      });
      if (!user) throw new UnauthorizedException('账号已停用或注销，请重新登录');

      const [earnedThroughCandidate, deductionAggregate] = await Promise.all([
        tx.pointsRecord.aggregate({
          where: {
            userId,
            type: 1,
            OR: [
              { createdAt: { lt: candidate.createdAt } },
              { createdAt: candidate.createdAt, id: { lte: candidate.id } },
            ],
          },
          _sum: { points: true },
        }),
        tx.pointsRecord.aggregate({
          where: {
            userId,
            type: { in: [2, 3] },
            createdAt: { lte: now },
          },
          _sum: { points: true },
        }),
      ]);

      const cumulativeEarned = Math.max(0, earnedThroughCandidate._sum.points ?? 0);
      const cumulativeDeducted = Math.max(0, deductionAggregate._sum.points ?? 0);
      const fifoRemainderThroughCandidate = Math.max(0, cumulativeEarned - cumulativeDeducted);
      const unspentFromCandidate = Math.min(
        Math.max(0, candidate.points),
        fifoRemainderThroughCandidate,
      );
      const pointsToExpire = Math.min(user.availablePoints, unspentFromCandidate);

      let balance = user.availablePoints;
      if (pointsToExpire > 0) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { availablePoints: { decrement: pointsToExpire } },
          select: { availablePoints: true },
        });
        balance = updatedUser.availablePoints;
      }

      await tx.pointsRecord.create({
        data: {
          userId,
          type: 3,
          points: pointsToExpire,
          balance,
          source: 'expire',
          sourceId: candidate.id,
          description: pointsToExpire > 0
            ? `积分到期，按FIFO扣除该笔剩余${pointsToExpire}积分`
            : '积分到期，该笔积分已在到期前消费，无需再次扣减',
        },
      });
      processed += 1;
      deducted += pointsToExpire;
    }
  }

  // Never let checkout fall through with an unbounded historical expiry backlog. The scheduler
  // can drain it and the user can retry; consuming potentially expired value would be irreversible.
  const remaining = await tx.$queryRaw<Array<{ id: bigint }>>`
    SELECT r.id AS id
    FROM points_records r
    WHERE r.user_id = ${userId}
      AND r.type = 1
      AND r.expire_at IS NOT NULL
      AND r.expire_at <= ${now}
      AND NOT EXISTS (
        SELECT 1
        FROM points_records marker
        WHERE marker.source IN ('expire', 'expire_marker')
          AND marker.source_id = r.id
      )
    LIMIT 1
  `;
  if (remaining.length > 0) {
    throw new BadRequestException('积分到期结算处理中，请稍后重试');
  }
  return { processed, deducted };
}

/**
 * Coupon preview happens before the order transaction. Re-check expiry on the actual FREE ->
 * LOCKED write so a coupon that expires in that narrow gap cannot be committed to an order.
 * A null UserCoupon.expireAt is the established non-expiring/historical-valid representation and
 * must remain redeemable, matching CouponService.findUsable().
 */
export function withFreshCheckoutCouponLock(
  tx: Prisma.TransactionClient,
): Prisma.TransactionClient {
  const userCouponDelegate = tx.userCoupon;
  if (!userCouponDelegate || typeof (userCouponDelegate as any).updateMany !== 'function') {
    return tx;
  }

  const userCouponProxy = new Proxy(userCouponDelegate as any, {
    get(target, property) {
      if (property === 'updateMany') {
        return async (args: any) => {
          const isCheckoutLock =
            args?.where?.status === COUPON_STATUS.FREE
            && args?.data?.status === COUPON_STATUS.LOCKED;
          if (!isCheckoutLock) return target.updateMany(args);

          const existingAnd = args?.where?.AND;
          const existingAndClauses = existingAnd === undefined
            ? []
            : Array.isArray(existingAnd)
              ? existingAnd
              : [existingAnd];

          return target.updateMany({
            ...args,
            where: {
              ...args.where,
              AND: [
                ...existingAndClauses,
                {
                  OR: [
                    { expireAt: null },
                    { expireAt: { gte: new Date() } },
                  ],
                },
              ],
            },
          });
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(tx as any, {
    get(target, property) {
      if (property === 'userCoupon') return userCouponProxy;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Prisma.TransactionClient;
}

export async function lockActivePickupStore(
  tx: Prisma.TransactionClient,
  pickupStoreId: bigint,
): Promise<LockedPickupStore> {
  const rows = await tx.$queryRaw<LockedPickupStore[]>`
    SELECT
      id,
      name,
      province,
      city,
      district,
      address,
      contact_phone AS contactPhone
    FROM pickup_stores
    WHERE id = ${pickupStoreId}
      AND status = 1
      AND deleted_at IS NULL
    FOR UPDATE
  `;
  const store = rows[0];
  if (!store) throw new NotFoundException('自提点不存在或已停用');
  return store;
}

export function withLockedPickupStoreSnapshot(
  tx: Prisma.TransactionClient,
  store: LockedPickupStore,
): Prisma.TransactionClient {
  const orderDelegate = tx.order;
  const orderProxy = new Proxy(orderDelegate as any, {
    get(target, property) {
      if (property === 'create') {
        return async (args: any) => {
          if (args?.data?.fulfillmentType !== 'pickup') {
            return target.create(args);
          }
          return target.create({
            ...args,
            data: {
              ...args.data,
              pickupStoreId: store.id,
              pickupStoreName: store.name,
              pickupStoreAddress: `${store.province}${store.city}${store.district}${store.address}`,
              pickupContactPhone: store.contactPhone,
            },
          });
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(tx as any, {
    get(target, property) {
      if (property === 'order') return orderProxy;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Prisma.TransactionClient;
}

export function withLockedPickupStoreRead(
  tx: Prisma.TransactionClient,
  store: LockedPickupStore,
): Prisma.TransactionClient {
  const pickupStoreDelegate = tx.pickupStore;
  const pickupStoreProxy = new Proxy(pickupStoreDelegate as any, {
    get(target, property) {
      if (property === 'findFirst') {
        return async (args: any) => {
          const requestedId = args?.where?.id;
          const expectsActive = args?.where?.status === 1;
          const excludesDeleted = args?.where?.deletedAt === null;
          if (
            requestedId?.toString?.() === store.id.toString() &&
            expectsActive &&
            excludesDeleted
          ) {
            return store;
          }
          return target.findFirst(args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(tx as any, {
    get(target, property) {
      if (property === 'pickupStore') return pickupStoreProxy;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Prisma.TransactionClient;
}
