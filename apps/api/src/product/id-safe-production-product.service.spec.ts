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

  it('passes a valid bigint identifier beyond the JS safe-integer range without Number coercion', async () => {
    const validBigIntId = '9007199254740993';
    const detailSpy = jest
      .spyOn(ProductionProductService.prototype, 'findById')
      .mockResolvedValue({ id: validBigIntId } as any);

    await service().findById(validBigIntId);

    expect(detailSpy).toHaveBeenCalledWith(validBigIntId);
  });
});
