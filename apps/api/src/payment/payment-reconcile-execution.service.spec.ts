import { ConflictException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { PaymentReconcileExecutionService } from './payment-reconcile-execution.service';

function createService() {
  const redis = {
    setNX: jest.fn<any>().mockResolvedValue(true),
    extendLockWithLua: jest.fn<any>().mockResolvedValue(true),
    releaseLockWithLua: jest.fn<any>().mockResolvedValue(true),
  };
  const reconcile = {
    reconcilePendingPayments: jest.fn<any>().mockResolvedValue({ total: 1, fixed: 1, failed: 0, skipped: 0 }),
    reconcilePendingRefunds: jest.fn<any>().mockResolvedValue({ total: 1, fixed: 1, failed: 0, skipped: 0 }),
  };
  const service = new PaymentReconcileExecutionService(redis as any, reconcile as any);
  return { service, redis, reconcile };
}

describe('PaymentReconcileExecutionService', () => {
  it('手工支付对账与 Cron 复用同一 lease key，并按所有权释放', async () => {
    const { service, redis, reconcile } = createService();

    const result = await service.reconcilePayments();

    expect(result.fixed).toBe(1);
    expect(redis.setNX).toHaveBeenCalledWith(
      'schedule:payment_reconcile',
      expect.any(String),
      240,
    );
    expect(reconcile.reconcilePendingPayments).toHaveBeenCalledTimes(1);
    const lockValue = redis.setNX.mock.calls[0][1];
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:payment_reconcile',
      lockValue,
    );
  });

  it('lease 已被 Cron 或另一管理员持有时 fail-closed，不执行退款对账', async () => {
    const { service, redis, reconcile } = createService();
    redis.setNX.mockResolvedValue(false);

    await expect(service.reconcileRefunds()).rejects.toBeInstanceOf(ConflictException);

    expect(redis.setNX).toHaveBeenCalledWith(
      'schedule:refund_reconcile',
      expect.any(String),
      240,
    );
    expect(reconcile.reconcilePendingRefunds).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).not.toHaveBeenCalled();
  });

  it('对账执行抛错时仍释放当前 lease', async () => {
    const { service, redis, reconcile } = createService();
    reconcile.reconcilePendingPayments.mockRejectedValue(new Error('wechat timeout'));

    await expect(service.reconcilePayments()).rejects.toThrow('wechat timeout');

    const lockValue = redis.setNX.mock.calls[0][1];
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:payment_reconcile',
      lockValue,
    );
  });
});
