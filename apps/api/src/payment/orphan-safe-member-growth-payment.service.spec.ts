import * as crypto from 'crypto';
import { MemberGrowthConservingPaymentService } from './member-growth-conserving-payment.service';
import { OrphanSafeMemberGrowthPaymentService } from './orphan-safe-member-growth-payment.service';

const API_V3_KEY = '12345678901234567890123456789012';

function encryptRefundResource(outRefundNo: string) {
  const nonce = '0123456789ab';
  const associatedData = 'refund';
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(API_V3_KEY, 'utf8'),
    Buffer.from(nonce, 'utf8'),
  );
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify({ out_refund_no: outRefundNo }), 'utf8')),
    cipher.final(),
  ]);
  const encrypted = Buffer.concat([ciphertext, cipher.getAuthTag()]).toString('base64');
  return {
    algorithm: 'AEAD_AES_256_GCM',
    ciphertext: encrypted,
    associated_data: associatedData,
    nonce,
  };
}

describe('OrphanSafeMemberGrowthPaymentService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService(localRefund: any) {
    const service = Object.create(OrphanSafeMemberGrowthPaymentService.prototype) as any;
    service.orphanPrisma = {
      orderRefund: {
        findFirst: jest.fn().mockResolvedValue(localRefund),
      },
    };
    service.orphanConfig = {
      get: jest.fn((key: string) => key === 'WECHAT_API_V3_KEY' ? API_V3_KEY : undefined),
    };
    service.orphanLogger = {
      error: jest.fn(),
    };
    return service;
  }

  it('本地退款记录存在时保持微信 SUCCESS 应答', async () => {
    jest.spyOn(MemberGrowthConservingPaymentService.prototype, 'handleRefundCallback')
      .mockResolvedValue({ code: 'SUCCESS', message: '' });
    const service = createService({ id: 7n, status: 'success' });
    const body = { resource: encryptRefundResource('OR-LOCAL-1') };

    await expect(service.handleRefundCallback(body, {}, Buffer.from('{}')))
      .resolves.toEqual({ code: 'SUCCESS', message: '' });
    expect(service.orphanPrisma.orderRefund.findFirst).toHaveBeenCalledWith({
      where: { outRefundNo: 'OR-LOCAL-1' },
      select: { id: true, status: true },
    });
  });

  it('本地退款记录不存在时返回 FAIL，交由控制器用非2xx触发微信重试', async () => {
    jest.spyOn(MemberGrowthConservingPaymentService.prototype, 'handleRefundCallback')
      .mockResolvedValue({ code: 'SUCCESS', message: '' });
    const service = createService(null);
    const body = { resource: encryptRefundResource('OR-ORPHAN-1') };

    const result = await service.handleRefundCallback(body, {}, Buffer.from('{}'));

    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('本地退款记录不存在');
    expect(service.orphanLogger.error).toHaveBeenCalled();
  });

  it('底层已返回 FAIL 时不覆盖原始失败原因', async () => {
    jest.spyOn(MemberGrowthConservingPaymentService.prototype, 'handleRefundCallback')
      .mockResolvedValue({ code: 'FAIL', message: '退款金额不匹配' });
    const service = createService(null);

    await expect(service.handleRefundCallback({ resource: {} }, {}, Buffer.from('{}')))
      .resolves.toEqual({ code: 'FAIL', message: '退款金额不匹配' });
    expect(service.orphanPrisma.orderRefund.findFirst).not.toHaveBeenCalled();
  });

  it('底层返回 SUCCESS 但本地无法再次确认退款单号时 fail-closed', async () => {
    jest.spyOn(MemberGrowthConservingPaymentService.prototype, 'handleRefundCallback')
      .mockResolvedValue({ code: 'SUCCESS', message: '' });
    const service = createService(null);

    const result = await service.handleRefundCallback(
      { resource: { ciphertext: 'bad', nonce: '0123456789ab' } },
      {},
      Buffer.from('{}'),
    );

    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('本地确认失败');
    expect(service.orphanLogger.error).toHaveBeenCalled();
  });
});
