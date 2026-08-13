import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchDeliverDto, DeliverDto } from './deliver.dto';

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

  it('rejects logistics values longer than the VARCHAR(50) database columns', async () => {
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

  it('applies the same limit to every batch-delivery row', async () => {
    const dto = plainToInstance(BatchDeliverDto, {
      orders: [{
        orderId: '123',
        logisticsCompany: '顺丰速运',
        logisticsNo: 'X'.repeat(51),
      }],
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('orders');
  });
});
