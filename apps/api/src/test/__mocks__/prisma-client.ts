export const OrderStatus = {
  pending_payment: 'pending_payment',
  paid: 'paid',
  pending_delivery: 'pending_delivery',
  pending_pickup: 'pending_pickup',
  delivered: 'delivered',
  completed: 'completed',
  aftersale: 'aftersale',
  cancelled: 'cancelled',
};

export const AftersaleStatus = {
  pending_review: 'pending_review',
  approved: 'approved',
  rejected: 'rejected',
  returned: 'returned',
  pending_refund: 'pending_refund',
  refunded: 'refunded',
  closed: 'closed',
};

export const PAYMENT_STATUS = {
  CREATED: 1,
  SUCCESS: 2,
  FAILED: 3,
};

export const REFUND_STATUS = {
  INITIATING: 'initiating',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  CLOSED: 'closed',
  ABNORMAL: 'abnormal',
};

export class PrismaClient {
  constructor() {}
}

class PrismaClientKnownRequestError extends Error {
  readonly code: string;
  readonly clientVersion: string;
  readonly meta?: Record<string, unknown>;

  constructor(
    message: string,
    options: { code: string; clientVersion: string; meta?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = options.code;
    this.clientVersion = options.clientVersion;
    this.meta = options.meta;
  }
}

export const Prisma = {
  DbNull: class {},
  JsonNull: class {},
  HttpError: class {},
  Decimal: class {},
  PrismaClientKnownRequestError,
};

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];
export type AftersaleStatus = typeof AftersaleStatus[keyof typeof AftersaleStatus];