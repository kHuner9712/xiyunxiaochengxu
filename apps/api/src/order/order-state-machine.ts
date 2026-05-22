import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.pending_payment]: [OrderStatus.cancelled, OrderStatus.paid, OrderStatus.pending_delivery],
  [OrderStatus.paid]: [OrderStatus.pending_delivery],
  [OrderStatus.pending_delivery]: [OrderStatus.delivered],
  [OrderStatus.delivered]: [OrderStatus.completed, OrderStatus.aftersale],
  [OrderStatus.completed]: [OrderStatus.aftersale],
  [OrderStatus.aftersale]: [OrderStatus.delivered, OrderStatus.completed],
  [OrderStatus.cancelled]: [],
};

export const TRANSITION_ACTIONS: Record<string, { from: OrderStatus[]; to: OrderStatus }> = {
  cancel: {
    from: [OrderStatus.pending_payment],
    to: OrderStatus.cancelled,
  },
  pay_success: {
    from: [OrderStatus.pending_payment],
    to: OrderStatus.pending_delivery,
  },
  deliver: {
    from: [OrderStatus.pending_delivery],
    to: OrderStatus.delivered,
  },
  confirm_receive: {
    from: [OrderStatus.delivered],
    to: OrderStatus.completed,
  },
  apply_aftersale: {
    from: [OrderStatus.delivered, OrderStatus.completed],
    to: OrderStatus.aftersale,
  },
  aftersale_resolve_to_delivered: {
    from: [OrderStatus.aftersale],
    to: OrderStatus.delivered,
  },
  aftersale_resolve_to_completed: {
    from: [OrderStatus.aftersale],
    to: OrderStatus.completed,
  },
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus, action?: string) {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `状态转换不允许：${from} -> ${to}${action ? `（操作：${action}）` : ''}`
    );
  }
}

export function getActionForTransition(from: OrderStatus, to: OrderStatus): string | null {
  for (const [action, rule] of Object.entries(TRANSITION_ACTIONS)) {
    if (rule.from.includes(from) && rule.to === to) {
      return action;
    }
  }
  return null;
}
