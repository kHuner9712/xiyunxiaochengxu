import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchDeliverDto, DeliverDto } from './deliver.dto';

function deliveryRow(orderId = '123') {
  return {
    orderId,
    logisticsCompany: '顺丰速运',
    logisticsNo: 'SF1234567890',
  };
}

describe('delivery DTO database limits', () => {
  it('trims valid single-delivery fields before persistence', async () => {
    const dto = plainToInstance(DeliverDto, {
      orderId: '123',
      logisticsCompany: '  顺丰速运  ',
      logisticsNo: '  SF1234567890  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.logisticsCompany).toBe('顺丰速运');
    expect(dto.logisticsNo).toBe('SF1234567890');
  });

  it('rejects zero order ids and logistics values longer than VARCHAR(50)', async () => {
    const zeroId = plainToInstance(DeliverDto, deliveryRow('0'));
    expect((await validate(zeroId)).some((error) => error.property === 'orderId')).toBe(true);

    const dto = plainToInstance(DeliverDto, {
      orderId: '123',
      logisticsCompany: 'A'.repeat(51),
      logisticsNo: 'B'.repeat(51),
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['logisticsCompany', 'logisticsNo']),
    );
  });

  it('requires 1-50 orders and applies field limits to every batch-delivery row', async () => {
    const valid = plainToInstance(BatchDeliverDto, { orders: [deliveryRow()] });
    expect(await validate(valid)).toHaveLength(0);

    const empty = plainToInstance(BatchDeliverDto, { orders: [] });
    expect((await validate(empty)).some((error) => error.property === 'orders')).toBe(true);

    const tooMany = plainToInstance(BatchDeliverDto, {
      orders: Array.from({ length: 51 }, (_, index) => deliveryRow(String(index + 1))),
    });
    expect((await validate(tooMany)).some((error) => error.property === 'orders')).toBe(true);

    const overlong = plainToInstance(BatchDeliverDto, {
      orders: [{
        orderId: '123',
        logisticsCompany: '顺丰速运',
        logisticsNo: 'X'.repeat(51),
      }],
    });
    const errors = await validate(overlong);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('orders');
  });
});
