import 'reflect-metadata';
import { validate } from 'class-validator';
import { OrderQueryDto } from './order-query.dto';

describe('OrderQueryDto', () => {
  it('接受合法订单状态枚举', async () => {
    const dto = new OrderQueryDto();
    dto.status = 'pending_pickup';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('拒绝数字订单状态字符串', async () => {
    const dto = new OrderQueryDto();
    dto.status = '10';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });
});
