import { NotFoundException } from '@nestjs/common';
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
