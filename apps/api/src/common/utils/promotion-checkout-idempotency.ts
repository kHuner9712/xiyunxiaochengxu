import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PromotionCheckoutIdempotencyContext {
  userId: string;
  orderNo: string;
}

const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i;

export function normalizePromotionClientRequestId(value: unknown): string {
  const requestId = String(value ?? '').trim();
  if (!CLIENT_REQUEST_ID_PATTERN.test(requestId)) {
    throw new BadRequestException('促销下单请求标识格式无效');
  }
  const submittedAtMs = Number(requestId.slice(0, 13));
  if (!Number.isSafeInteger(submittedAtMs) || submittedAtMs <= 0) {
    throw new BadRequestException('促销下单请求标识时间无效');
  }
  return requestId;
}

export function buildPromotionCheckoutOrderNo(
  userId: bigint | string,
  scope: string,
  clientRequestId: string,
): string {
  const normalizedRequestId = normalizePromotionClientRequestId(clientRequestId);
  const submittedAtMs = Number(normalizedRequestId.slice(0, 13));

  // Preserve the existing XY + yyyyMMddHHmmss + 12-char suffix convention. Use a fixed UTC+8
  // conversion so one request identity maps to the same order number in every runtime timezone.
  const chinaTime = new Date(submittedAtMs + 8 * 60 * 60 * 1000);
  const timestamp = [
    chinaTime.getUTCFullYear(),
    String(chinaTime.getUTCMonth() + 1).padStart(2, '0'),
    String(chinaTime.getUTCDate()).padStart(2, '0'),
    String(chinaTime.getUTCHours()).padStart(2, '0'),
    String(chinaTime.getUTCMinutes()).padStart(2, '0'),
    String(chinaTime.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  const suffix = crypto
    .createHash('sha256')
    .update(`${userId}:${scope}:${normalizedRequestId}`)
    .digest('hex')
    .slice(0, 12);
  return `XY${timestamp}${suffix}`;
}

function proxyTransactionOrderCreate(
  tx: any,
  context: PromotionCheckoutIdempotencyContext,
) {
  if (!tx?.order || typeof tx.order.create !== 'function') return tx;
  const orderDelegate = tx.order;
  const orderProxy = new Proxy(orderDelegate, {
    get(target, property) {
      if (property === 'create') {
        return async (args: any) => {
          const sameUser = args?.data?.userId?.toString?.() === context.userId;
          if (!sameUser) return target.create(args);
          return target.create({
            ...args,
            data: {
              ...args.data,
              orderNo: context.orderNo,
            },
          });
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(tx, {
    get(target, property) {
      if (property === 'order') return orderProxy;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function createPromotionCheckoutPrismaProxy(
  prisma: PrismaService,
  storage: AsyncLocalStorage<PromotionCheckoutIdempotencyContext>,
): PrismaService {
  return new Proxy(prisma as any, {
    get(target, property) {
      if (property !== '$transaction') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (input: any, ...rest: any[]) => {
        const originalTransaction = Reflect.get(target, '$transaction', target);
        if (typeof originalTransaction !== 'function') {
          throw new TypeError('PrismaService.$transaction is not available');
        }
        const context = storage.getStore();
        if (!context || typeof input !== 'function') {
          return originalTransaction.call(target, input, ...rest);
        }
        return originalTransaction.call(
          target,
          async (tx: any) => input(proxyTransactionOrderCreate(tx, context)),
          ...rest,
        );
      };
    },
  }) as PrismaService;
}
