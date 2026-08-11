import { BadRequestException } from '@nestjs/common';
import { ProductionProductService } from './production-product.service';
import { IdSafeProductionProductService } from './id-safe-production-product.service';

describe('IdSafeProductionProductService', () => {
  afterEach(() => jest.restoreAllMocks());

  function service() {
    return new IdSafeProductionProductService({} as any);
  }

  it.each(['findById', 'findAdminById', 'delete'] as const)(
    '%s rejects malformed identifiers before reaching the base service',
    async (method) => {
      const baseSpy = jest
        .spyOn(ProductionProductService.prototype as any, method)
        .mockResolvedValue({});

      await expect((service() as any)[method]('not-an-id')).rejects.toBeInstanceOf(BadRequestException);
      expect(baseSpy).not.toHaveBeenCalled();
    },
  );

  it('updateStatus rejects malformed identifiers before reaching the base service', async () => {
    const baseSpy = jest
      .spyOn(ProductionProductService.prototype, 'updateStatus')
      .mockResolvedValue({} as any);

    await expect(service().updateStatus('not-an-id', 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(baseSpy).not.toHaveBeenCalled();
  });

  it('passes canonical decimal identifiers to the inherited product implementation', async () => {
    const detailSpy = jest
      .spyOn(ProductionProductService.prototype, 'findById')
      .mockResolvedValue({ id: '900719925474099312345' } as any);

    await service().findById('900719925474099312345');

    expect(detailSpy).toHaveBeenCalledWith('900719925474099312345');
  });
});
