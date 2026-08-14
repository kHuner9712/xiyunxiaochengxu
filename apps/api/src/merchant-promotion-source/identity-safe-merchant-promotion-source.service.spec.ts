import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MerchantPromotionSourceService } from './merchant-promotion-source.service';
import { IdentitySafeMerchantPromotionSourceService } from './identity-safe-merchant-promotion-source.service';

function createService(existing: { promotionCode: string } | null) {
  const prisma: any = {
    merchantPromotionSource: {
      findFirst: jest.fn().mockResolvedValue(existing),
    },
  };
  return {
    prisma,
    service: new IdentitySafeMerchantPromotionSourceService(prisma),
  };
}

describe('IdentitySafeMerchantPromotionSourceService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects changing a promotion code because orders persist it as historical attribution identity', async () => {
    const baseUpdate = jest
      .spyOn(MerchantPromotionSourceService.prototype, 'update')
      .mockResolvedValue({} as any);
    const { service } = createService({ promotionCode: 'MERCHANT-A' });

    await expect(
      service.update('42', { promotionCode: 'merchant-b' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(baseUpdate).not.toHaveBeenCalled();
  });

  it('allows ordinary field edits when the immutable code is unchanged', async () => {
    const baseUpdate = jest
      .spyOn(MerchantPromotionSourceService.prototype, 'update')
      .mockResolvedValue({ id: '42' } as any);
    const { service } = createService({ promotionCode: 'MERCHANT-A' });

    await service.update('42', {
      promotionCode: ' merchant-a ',
      name: '新商家名称',
    } as any);

    expect(baseUpdate).toHaveBeenCalledWith('42', {
      promotionCode: ' merchant-a ',
      name: '新商家名称',
    });
  });

  it('preserves not-found behavior while validating immutable identity', async () => {
    const baseUpdate = jest
      .spyOn(MerchantPromotionSourceService.prototype, 'update')
      .mockResolvedValue({} as any);
    const { service } = createService(null);

    await expect(
      service.update('42', { promotionCode: 'MERCHANT-A' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(baseUpdate).not.toHaveBeenCalled();
  });
});
