import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
