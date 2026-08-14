import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateGroupBuyActivityDto,
  GroupBuyActivityDto,
} from './group-buy.dto';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

function validPayload() {
  return {
    name: '3人拼团',
    productId: '11',
    skuId: '22',
    groupPrice: 9900,
    groupSize: 3,
    groupExpireHours: 24,
    startTime: '2026-08-15T00:00:00+08:00',
    endTime: '2026-08-16T00:00:00+08:00',
    status: 0,
  };
}

async function validateDto<T extends object>(type: new () => T, payload: Record<string, unknown>) {
  return validate(plainToInstance(type, payload), validationOptions);
}

describe('group buy admin production DTO contract', () => {
  it('accepts a create-only durable request id', async () => {
    await expect(validateDto(CreateGroupBuyActivityDto, {
      ...validPayload(),
      clientRequestId: '1234567890123456789',
    })).resolves.toHaveLength(0);
  });

  it('rejects create-only clientRequestId on update under production whitelist rules', async () => {
    const errors = await validateDto(GroupBuyActivityDto, {
      ...validPayload(),
      clientRequestId: '1234567890123456789',
    });
    expect(errors.some((error) => error.property === 'clientRequestId')).toBe(true);
  });

  it('rejects MySQL signed-INT overflow before persistence', async () => {
    const errors = await validateDto(GroupBuyActivityDto, {
      ...validPayload(),
      groupPrice: 2147483648,
      originalPrice: 2147483648,
      stockLimit: 2147483648,
      limitPerUser: 2147483648,
      sortOrder: 2147483648,
    });
    for (const field of ['groupPrice', 'originalPrice', 'stockLimit', 'limitPerUser', 'sortOrder']) {
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  });

  it('enforces existing admin bounds and database string lengths', async () => {
    const errors = await validateDto(GroupBuyActivityDto, {
      ...validPayload(),
      name: 'x'.repeat(101),
      groupSize: 101,
      groupExpireHours: 169,
      coverImage: 'x'.repeat(501),
    });
    for (const field of ['name', 'groupSize', 'groupExpireHours', 'coverImage']) {
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  });
});
