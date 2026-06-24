import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import { ConfirmOrderDto } from './confirm-order.dto';
import { CreateOrderDto } from './create-order.dto';

describe('ConfirmOrderDto', () => {
  it('rejects empty items', () => {
    const dto = plainToInstance(ConfirmOrderDto, { items: [] });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative quantity', () => {
    const dto = plainToInstance(ConfirmOrderDto, {
      items: [{ skuId: '1001', quantity: -1 }],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects items exceeding max size (100 items)', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      skuId: String(1000 + i),
      quantity: 1,
    }));
    const dto = plainToInstance(ConfirmOrderDto, { items });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects quantity exceeding max (100)', () => {
    const dto = plainToInstance(ConfirmOrderDto, {
      items: [{ skuId: '1001', quantity: 100 }],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects duplicate skuId', () => {
    const dto = plainToInstance(ConfirmOrderDto, {
      items: [
        { skuId: '1001', quantity: 1 },
        { skuId: '1001', quantity: 2 },
      ],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    const itemsError = errors.find((e) => e.property === 'items');
    expect(itemsError).toBeDefined();
    expect(itemsError!.constraints).toHaveProperty('confirmUniqueSkuIds');
  });

  it('accepts valid items', () => {
    const dto = plainToInstance(ConfirmOrderDto, {
      items: [
        { skuId: '1001', quantity: 1 },
        { skuId: '1002', quantity: 99 },
      ],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });
});

describe('CreateOrderDto', () => {
  it('rejects items exceeding max size (100 items)', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      skuId: String(1000 + i),
      quantity: 1,
    }));
    const dto = plainToInstance(CreateOrderDto, { items });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects quantity exceeding max (100)', () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [{ skuId: '1001', quantity: 100 }],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects duplicate skuId', () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [
        { skuId: '1001', quantity: 1 },
        { skuId: '1001', quantity: 2 },
      ],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    const itemsError = errors.find((e) => e.property === 'items');
    expect(itemsError).toBeDefined();
    expect(itemsError!.constraints).toHaveProperty('uniqueSkuIds');
  });

  it('accepts valid items', () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [{ skuId: '1001', quantity: 1 }],
    });
    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });
});
