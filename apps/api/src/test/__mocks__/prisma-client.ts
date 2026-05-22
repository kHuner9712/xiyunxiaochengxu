export const OrderStatus = {
  pending_payment: 'pending_payment',
  paid: 'paid',
  pending_delivery: 'pending_delivery',
  delivered: 'delivered',
  completed: 'completed',
  aftersale: 'aftersale',
  cancelled: 'cancelled',
};

export class PrismaClient {
  constructor() {}
}

export const Prisma = {
  DbNull: class {},
  JsonNull: class {},
  HttpError: class {},
  Decimal: class {},
};

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];
