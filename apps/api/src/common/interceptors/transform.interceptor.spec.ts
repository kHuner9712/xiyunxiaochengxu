import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TransformInterceptor } from './transform.interceptor';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TRANSFORM_SKIP_KEY } from '../decorators/skip-transform.decorator';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new TransformInterceptor(reflector);
  });

  const createMockContext = (skipTransform = false) => ({
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  });

  it('应包装响应为 { code: 0, message: success, data }', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({ name: 'test' }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual({ name: 'test' });
      done();
    });
  });

  it('BigInt 应序列化为字符串', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({ id: BigInt(123456789) }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.data.id).toBe('123456789');
      done();
    });
  });

  it('嵌套对象中的 BigInt 应序列化为字符串', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({
        order: {
          id: BigInt(1),
          orderNo: 'ORDER123',
          items: [
            { id: BigInt(10), name: 'item1' },
            { id: BigInt(20), name: 'item2' },
          ],
        },
      }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.data.order.id).toBe('1');
      expect(result.data.order.items[0].id).toBe('10');
      expect(result.data.order.items[1].id).toBe('20');
      expect(result.data.order.orderNo).toBe('ORDER123');
      done();
    });
  });

  it('数组中的 BigInt 应序列化为字符串', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of([BigInt(1), BigInt(2), BigInt(3)]),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.data).toEqual(['1', '2', '3']);
      done();
    });
  });

  it('Date 对象不应被序列化', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const date = new Date('2026-01-01');
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({ createdAt: date, id: BigInt(1) }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.data.createdAt).toBe(date);
      expect(result.data.id).toBe('1');
      done();
    });
  });

  it('null 和 undefined 应保持原样', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({ a: null, b: undefined }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.data.a).toBeNull();
      expect(result.data.b).toBeUndefined();
      done();
    });
  });

  it('SKIP_TRANSFORM 装饰器应跳过包装', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({ raw: 'data' }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result).toEqual({ raw: 'data' });
      expect(result).not.toHaveProperty('code');
      done();
    });
  });

  it('订单支付退款列表中的 BigInt ID 应全部序列化', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const mockContext = createMockContext() as any;
    const mockHandler = {
      handle: () => of({
        list: [
          { id: BigInt(1), orderId: BigInt(100), refundAmount: 1000 },
          { id: BigInt(2), orderId: BigInt(200), refundAmount: 2000 },
        ],
        total: 2,
      }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result.data.list[0].id).toBe('1');
      expect(result.data.list[0].orderId).toBe('100');
      expect(result.data.list[1].id).toBe('2');
      expect(result.data.list[1].orderId).toBe('200');
      expect(result.data.total).toBe(2);
      done();
    });
  });
});
