import { describe, it, expect } from '@jest/globals';
import {
  canTransition,
  assertOrderTransition,
  ALLOWED_TRANSITIONS,
} from './order-state-machine';
import { OrderStatus } from '@prisma/client';

describe('OrderStateMachine', () => {
  describe('canTransition', () => {
    describe('允许的转换', () => {
      it('pending_payment -> pending_delivery 应该允许', () => {
        expect(canTransition(OrderStatus.pending_payment, OrderStatus.pending_delivery)).toBe(true);
      });

      it('pending_payment -> cancelled 应该允许', () => {
        expect(canTransition(OrderStatus.pending_payment, OrderStatus.cancelled)).toBe(true);
      });

      it('pending_delivery -> delivered 应该允许', () => {
        expect(canTransition(OrderStatus.pending_delivery, OrderStatus.delivered)).toBe(true);
      });

      it('delivered -> completed 应该允许', () => {
        expect(canTransition(OrderStatus.delivered, OrderStatus.completed)).toBe(true);
      });

      it('delivered -> aftersale 应该允许', () => {
        expect(canTransition(OrderStatus.delivered, OrderStatus.aftersale)).toBe(true);
      });

      it('completed -> aftersale 应该允许', () => {
        expect(canTransition(OrderStatus.completed, OrderStatus.aftersale)).toBe(true);
      });

      it('aftersale -> delivered 应该允许', () => {
        expect(canTransition(OrderStatus.aftersale, OrderStatus.delivered)).toBe(true);
      });

      it('aftersale -> completed 应该允许', () => {
        expect(canTransition(OrderStatus.aftersale, OrderStatus.completed)).toBe(true);
      });
    });

    describe('禁止的转换', () => {
      it('cancelled -> pending_payment 应该禁止', () => {
        expect(canTransition(OrderStatus.cancelled, OrderStatus.pending_payment)).toBe(false);
      });

      it('pending_delivery -> completed 应该禁止', () => {
        expect(canTransition(OrderStatus.pending_delivery, OrderStatus.completed)).toBe(false);
      });

      it('pending_delivery -> cancelled 应该禁止', () => {
        expect(canTransition(OrderStatus.pending_delivery, OrderStatus.cancelled)).toBe(false);
      });

      it('delivered -> cancelled 应该禁止', () => {
        expect(canTransition(OrderStatus.delivered, OrderStatus.cancelled)).toBe(false);
      });

      it('completed -> cancelled 应该禁止', () => {
        expect(canTransition(OrderStatus.completed, OrderStatus.cancelled)).toBe(false);
      });

      it('completed -> pending_delivery 应该禁止', () => {
        expect(canTransition(OrderStatus.completed, OrderStatus.pending_delivery)).toBe(false);
      });

      it('pending_payment -> delivered 应该禁止', () => {
        expect(canTransition(OrderStatus.pending_payment, OrderStatus.delivered)).toBe(false);
      });

      it('cancelled -> delivered 应该禁止', () => {
        expect(canTransition(OrderStatus.cancelled, OrderStatus.delivered)).toBe(false);
      });
    });
  });

  describe('assertOrderTransition', () => {
    it('允许的转换不应该抛出异常', () => {
      expect(() => {
        assertOrderTransition(OrderStatus.pending_payment, OrderStatus.pending_delivery, '支付成功');
      }).not.toThrow();
    });

    it('禁止的转换应该抛出 BadRequestException', () => {
      expect(() => {
        assertOrderTransition(OrderStatus.cancelled, OrderStatus.pending_payment, '恢复订单');
      }).toThrow();
    });

    it('禁止的转换异常消息应该包含状态信息', () => {
      try {
        assertOrderTransition(OrderStatus.pending_delivery, OrderStatus.completed, '跳过发货');
      } catch (error: any) {
        expect(error.message).toContain('pending_delivery');
        expect(error.message).toContain('completed');
        expect(error.message).toContain('跳过发货');
      }
    });
  });

  describe('ALLOWED_TRANSITIONS 完整性', () => {
    it('每个状态都应该在转换表中定义', () => {
      const allStatuses = [
        OrderStatus.pending_payment,
        OrderStatus.paid,
        OrderStatus.pending_delivery,
        OrderStatus.delivered,
        OrderStatus.completed,
        OrderStatus.aftersale,
        OrderStatus.cancelled,
      ];

      allStatuses.forEach((status) => {
        expect(ALLOWED_TRANSITIONS).toHaveProperty(status);
      });
    });

    it('终态 cancelled 应该没有可转换状态', () => {
      expect(ALLOWED_TRANSITIONS[OrderStatus.cancelled]).toEqual([]);
    });

    it('终态 completed 和 aftersale 可能有可转换状态', () => {
      expect(Array.isArray(ALLOWED_TRANSITIONS[OrderStatus.completed])).toBe(true);
      expect(Array.isArray(ALLOWED_TRANSITIONS[OrderStatus.aftersale])).toBe(true);
    });
  });
});
