import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAftersaleDto } from './create-aftersale.dto';

function validPayload() {
  return {
    orderId: '1001',
    orderItemId: '2001',
    type: 1,
    reason: '质量问题',
    description: '外包装损坏',
    images: ['/api/common/file/private/3001'],
  };
}

describe('CreateAftersaleDto', () => {
  it('trims and accepts valid persisted fields', async () => {
    const dto = plainToInstance(CreateAftersaleDto, {
      ...validPayload(),
      reason: '  质量问题  ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.reason).toBe('质量问题');
  });

  it('rejects zero ids and invalid reason boundaries', async () => {
    const zeroOrder = plainToInstance(CreateAftersaleDto, { ...validPayload(), orderId: '0' });
    expect((await validate(zeroOrder)).some((error) => error.property === 'orderId')).toBe(true);

    const zeroItem = plainToInstance(CreateAftersaleDto, { ...validPayload(), orderItemId: '0' });
    expect((await validate(zeroItem)).some((error) => error.property === 'orderItemId')).toBe(true);

    const whitespace = plainToInstance(CreateAftersaleDto, { ...validPayload(), reason: '   ' });
    expect((await validate(whitespace)).some((error) => error.property === 'reason')).toBe(true);

    const overlong = plainToInstance(CreateAftersaleDto, { ...validPayload(), reason: '原'.repeat(201) });
    expect((await validate(overlong)).some((error) => error.property === 'reason')).toBe(true);
  });
});
