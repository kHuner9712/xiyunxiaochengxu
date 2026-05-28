import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfirmOrderDto } from './confirm-order.dto';

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
});
