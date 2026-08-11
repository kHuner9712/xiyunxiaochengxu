import { BadRequestException } from '@nestjs/common';
import { SnapshotViewBenefitPackageService } from './snapshot-view-benefit-package.service';
import { ValiditySafeSnapshotViewBenefitPackageService } from './validity-safe-snapshot-view-benefit-package.service';

describe('ValiditySafeSnapshotViewBenefitPackageService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('marks a future entitlement as not verifiable in preview', async () => {
    const service = new ValiditySafeSnapshotViewBenefitPackageService({} as any, {} as any);
    jest.spyOn(SnapshotViewBenefitPackageService.prototype, 'previewVerify').mockResolvedValue({
      canVerify: true,
      reason: '',
      validFrom: new Date(Date.now() + 60_000),
      validTo: new Date(Date.now() + 120_000),
    } as any);

    const result: any = await service.previewVerify('ABC12345');

    expect(result.canVerify).toBe(false);
    expect(result.reason).toBe('权益尚未生效');
  });

  it('rejects actual verification before validFrom without calling the parent verify', async () => {
    const service = new ValiditySafeSnapshotViewBenefitPackageService({} as any, {} as any);
    jest.spyOn(SnapshotViewBenefitPackageService.prototype, 'previewVerify').mockResolvedValue({
      canVerify: true,
      reason: '',
      validFrom: new Date(Date.now() + 60_000),
    } as any);
    const parentVerify = jest
      .spyOn(SnapshotViewBenefitPackageService.prototype, 'verify')
      .mockResolvedValue({ entitlementId: 1n } as any);

    await expect(service.verify('ABC12345', '9')).rejects.toBeInstanceOf(BadRequestException);
    expect(parentVerify).not.toHaveBeenCalled();
  });

  it('delegates to the existing hardened verification chain once validFrom has arrived', async () => {
    const service = new ValiditySafeSnapshotViewBenefitPackageService({} as any, {} as any);
    jest.spyOn(SnapshotViewBenefitPackageService.prototype, 'previewVerify').mockResolvedValue({
      canVerify: true,
      reason: '',
      validFrom: new Date(Date.now() - 60_000),
    } as any);
    const parentVerify = jest
      .spyOn(SnapshotViewBenefitPackageService.prototype, 'verify')
      .mockResolvedValue({ entitlementId: 1n, verifyCode: 'ABC12345' } as any);

    await expect(service.verify('ABC12345', '9')).resolves.toEqual({
      entitlementId: 1n,
      verifyCode: 'ABC12345',
    });
    expect(parentVerify).toHaveBeenCalledWith('ABC12345', '9', undefined);
  });
});
