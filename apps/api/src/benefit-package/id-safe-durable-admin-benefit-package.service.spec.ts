import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { DurableAdminBenefitPackageService } from './durable-admin-benefit-package.service';
import { IdSafeDurableAdminBenefitPackageService } from './id-safe-durable-admin-benefit-package.service';

function createService() {
  return new IdSafeDurableAdminBenefitPackageService({} as any, {} as any);
}

describe('IdSafeDurableAdminBenefitPackageService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['abc', '0', '-1', '9223372036854775808'])(
    '小程序权益包详情拒绝非法 ID %s，而不是让 BigInt 转换异常逃逸为 500',
    async (id) => {
      const parent = jest
        .spyOn(DurableAdminBenefitPackageService.prototype, 'findDetailForWeapp')
        .mockResolvedValue({} as any);
      const service = createService();

      await expect(service.findDetailForWeapp(id)).rejects.toThrow(/权益包ID(无效|超出范围)/);
      expect(parent).not.toHaveBeenCalled();
    },
  );

  it('合法公开权益包 ID 规范化后交给完整 production provider', async () => {
    const parent = jest
      .spyOn(DurableAdminBenefitPackageService.prototype, 'findDetailForWeapp')
      .mockResolvedValue({ id: 9007199254740993n } as any);
    const service = createService();

    await service.findDetailForWeapp('9007199254740993');

    expect(parent).toHaveBeenCalledWith('9007199254740993');
  });

  it.each(['abc', '0', '-1', '9223372036854775808'])(
    '个人权益详情拒绝非法权益 ID %s',
    async (id) => {
      const parent = jest
        .spyOn(DurableAdminBenefitPackageService.prototype, 'findEntitlementForUser')
        .mockResolvedValue({} as any);
      const service = createService();

      await expect(service.findEntitlementForUser('123', id)).rejects.toThrow(/权益ID(无效|超出范围)/);
      expect(parent).not.toHaveBeenCalled();
    },
  );

  it('后台权益查询过滤条件在进入 BigInt 基类前完成安全解析', async () => {
    const parent = jest
      .spyOn(DurableAdminBenefitPackageService.prototype, 'findEntitlements')
      .mockResolvedValue({ list: [], total: 0 } as any);
    const service = createService();

    await service.findEntitlements({
      page: 1,
      pageSize: 20,
      userId: '123',
      packageId: '456',
      packageItemId: '789',
    });

    expect(parent).toHaveBeenCalledWith(expect.objectContaining({
      userId: '123',
      packageId: '456',
      packageItemId: '789',
    }));
  });

  it.each(['abc', '0', '-1', '9223372036854775808'])(
    '后台核销日志拒绝非法核销员 ID %s，而不是让筛选查询抛 500',
    async (id) => {
      const parent = jest
        .spyOn(DurableAdminBenefitPackageService.prototype, 'findVerificationLogs')
        .mockResolvedValue({ list: [], total: 0 } as any);
      const service = createService();

      await expect(service.findVerificationLogs({
        page: 1,
        pageSize: 20,
        verifierId: id,
      })).rejects.toThrow(/核销员ID(无效|超出范围)/);
      expect(parent).not.toHaveBeenCalled();
    },
  );
});
