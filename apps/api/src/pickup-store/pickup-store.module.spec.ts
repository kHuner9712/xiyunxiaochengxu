import { Test } from '@nestjs/testing';
import { PickupStoreModule } from './pickup-store.module';
import { PickupStoreService } from './pickup-store.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { describe, it, expect, jest } from '@jest/globals';

const { TestingInjector } = require('@nestjs/testing/testing-injector');

describe('PickupStoreModule DI', () => {
  it('should resolve PickupStoreService from module graph', async () => {
    const originalInstantiateClass = TestingInjector.prototype.instantiateClass;
    TestingInjector.prototype.instantiateClass = async function (...args: any[]) {
      const wrapper = args[1];
      if (typeof wrapper?.metatype !== 'function' && wrapper?.inject == null) {
        console.error('[pickup-store-di] invalid provider wrapper', {
          name: wrapper?.name,
          token: String(wrapper?.token ?? ''),
          metatype: wrapper?.metatype,
          inject: wrapper?.inject,
        });
      }
      return originalInstantiateClass.apply(this, args);
    };

    try {
      const moduleRef = await Test.createTestingModule({
        imports: [PickupStoreModule],
      })
        .overrideProvider(PrismaService)
        .useValue({
          pickupStore: {
            findMany: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        })
        .overrideProvider(OrderService)
        .useValue({
          completePickupOrderByCode: jest.fn(),
        })
        .compile();

      expect(moduleRef.get(PickupStoreService)).toBeDefined();
      await moduleRef.close();
    } finally {
      TestingInjector.prototype.instantiateClass = originalInstantiateClass;
    }
  });
});
