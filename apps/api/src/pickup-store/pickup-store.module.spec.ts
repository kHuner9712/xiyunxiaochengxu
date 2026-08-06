import { Test } from '@nestjs/testing';
import { PickupStoreModule } from './pickup-store.module';
import { PickupStoreService } from './pickup-store.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { describe, it, expect, jest } from '@jest/globals';

describe('PickupStoreModule DI', () => {
  it('should resolve PickupStoreService from module graph', async () => {
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
  });
});
