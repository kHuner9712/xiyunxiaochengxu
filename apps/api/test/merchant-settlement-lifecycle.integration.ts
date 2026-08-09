import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { StateSafeProductionMerchantSettlementService } from '../src/merchant-settlement/state-safe-production-merchant-settlement.service';

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (
    !/(^|[_-])test($|[_-])/i.test(databaseName) &&
    process.env.ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== 'true'
  ) {
    throw new Error(`Refusing destructive integration test against database "${databaseName}"`);
  }
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

async function cleanup() {
  await prisma.merchantSettlementItem.deleteMany();
  await prisma.merchantSettlementBatch.deleteMany();
  await prisma.merchantCommissionRecord.deleteMany();
  await prisma.businessEvent.deleteMany({
    where: {
      bizType: { in: ['merchant_settlement_batch', 'merchant_commission_record'] },
    },
  });
}

async function main() {
  await prisma.$connect();
  await cleanup();
  const service = new StateSafeProductionMerchantSettlementService(prisma as any);

  try {
    const now = new Date();
    const occurredAt = new Date(now.getTime() - 60_000);
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const pendingRecord = await prisma.merchantCommissionRecord.create({
      data: {
        sourceType: 'sales_referral',
        sourceAmount: 10000,
        commissionAmount: 1000,
        calculationSnapshot: { sourceAmount: 10000, finalAmount: 1000 },
        status: 'pending',
        dedupeKey: 'settlement-lifecycle-pending',
        occurredAt,
      },
    });
    const originalConfirmedAt = new Date(now.getTime() - 60 * 60 * 1000);
    const confirmedRecord = await prisma.merchantCommissionRecord.create({
      data: {
        sourceType: 'service_verification',
        sourceAmount: 5000,
        commissionAmount: 500,
        calculationSnapshot: { sourceAmount: 5000, finalAmount: 500 },
        status: 'confirmed',
        confirmedAt: originalConfirmedAt,
        dedupeKey: 'settlement-lifecycle-confirmed',
        occurredAt,
      },
    });

    const firstBatch = await service.createBatch({ periodStart, periodEnd, remark: '第一次结算' });
    const firstItems = await prisma.merchantSettlementItem.findMany({
      where: { batchId: firstBatch.id },
      orderBy: { commissionRecordId: 'asc' },
    });
    assert.equal(firstItems.length, 2, '第一次批次必须包含两笔分佣');

    await assert.rejects(
      () => service.updateRecordStatus(pendingRecord.id.toString(), 'cancelled', '绕过批次'),
      /已进入结算批次/,
      '已进入批次的分佣不能通过单条状态接口绕过批次状态机',
    );

    await service.confirmBatch(firstBatch.id.toString(), '确认第一次结算');
    const afterConfirmPending = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: pendingRecord.id },
    });
    const afterConfirmPreconfirmed = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: confirmedRecord.id },
    });
    assert.equal(afterConfirmPending.status, 'confirmed');
    assert.equal(afterConfirmPreconfirmed.status, 'confirmed');

    await service.cancelBatch(firstBatch.id.toString(), '取消后重新生成');
    const cancelledBatch = await prisma.merchantSettlementBatch.findUniqueOrThrow({
      where: { id: firstBatch.id },
    });
    const afterCancelPending = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: pendingRecord.id },
    });
    const afterCancelPreconfirmed = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: confirmedRecord.id },
    });
    const remainingFirstItems = await prisma.merchantSettlementItem.count({
      where: { batchId: firstBatch.id },
    });
    const archivedItems = await prisma.businessEvent.findMany({
      where: {
        eventType: 'settlement_item_cancelled_snapshot',
        bizType: 'merchant_settlement_batch',
        bizId: firstBatch.id.toString(),
      },
    });

    assert.equal(cancelledBatch.status, 'cancelled');
    assert.equal(afterCancelPending.status, 'pending', '批次确认时才升格的 pending 分佣取消后必须恢复 pending');
    assert.equal(afterCancelPending.confirmedAt, null, '恢复 pending 时必须清除批次产生的 confirmedAt');
    assert.equal(afterCancelPreconfirmed.status, 'confirmed', '进入批次前已 confirmed 的分佣取消后必须保持 confirmed');
    assert.equal(
      afterCancelPreconfirmed.confirmedAt?.getTime(),
      originalConfirmedAt.getTime(),
      '原有 confirmedAt 不能被取消批次破坏',
    );
    assert.equal(remainingFirstItems, 0, '取消批次必须释放唯一结算明细占用以允许再次结算');
    assert.equal(archivedItems.length, 2, '释放唯一明细前必须为每笔分佣保存不可变取消快照');

    const cancelledView = await service.findBatchById(firstBatch.id.toString());
    assert.equal(cancelledView.items.length, 2, '取消后的批次详情必须能从审计快照恢复历史明细');
    assert.ok(cancelledView.items.every((item: any) => item.status === 'removed'));

    const secondBatch = await service.createBatch({ periodStart, periodEnd, remark: '重新结算' });
    assert.notEqual(secondBatch.id.toString(), firstBatch.id.toString());
    const secondItems = await prisma.merchantSettlementItem.findMany({
      where: { batchId: secondBatch.id },
    });
    assert.equal(secondItems.length, 2, '取消后的两笔分佣必须能够再次进入新批次');

    await service.confirmBatch(secondBatch.id.toString(), '确认重结算');
    await service.markBatchPaid(secondBatch.id.toString(), '真实付款完成');

    const paidBatch = await prisma.merchantSettlementBatch.findUniqueOrThrow({
      where: { id: secondBatch.id },
    });
    const settledItems = await prisma.merchantSettlementItem.findMany({
      where: { batchId: secondBatch.id },
    });
    const finalPendingRecord = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: pendingRecord.id },
    });
    const finalConfirmedRecord = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: confirmedRecord.id },
    });

    assert.equal(paidBatch.status, 'paid');
    assert.ok(settledItems.every((item) => item.status === 'settled'));
    assert.equal(finalPendingRecord.status, 'settled');
    assert.equal(finalConfirmedRecord.status, 'settled');

    await assert.rejects(
      () => service.cancelBatch(secondBatch.id.toString(), '禁止反向取消'),
      /已付款批次不可取消/,
      '已付款批次必须是终态',
    );
    await assert.rejects(
      () => service.updateRecordStatus(pendingRecord.id.toString(), 'pending', '禁止回退'),
      /已进入结算批次|已结算分佣不可回退/,
      '已结算分佣不能被单条状态接口回退',
    );

    const raceRecord = await prisma.merchantCommissionRecord.create({
      data: {
        sourceType: 'sales_referral',
        sourceAmount: 3000,
        commissionAmount: 300,
        calculationSnapshot: { sourceAmount: 3000, finalAmount: 300 },
        status: 'pending',
        dedupeKey: 'settlement-lifecycle-race',
        occurredAt,
      },
    });
    const raceBatch = await service.createBatch({ periodStart, periodEnd, remark: '并发竞争批次' });
    await service.confirmBatch(raceBatch.id.toString(), '进入并发竞争');

    const raceResults = await Promise.allSettled([
      service.markBatchPaid(raceBatch.id.toString(), '并发付款'),
      service.cancelBatch(raceBatch.id.toString(), '并发取消'),
    ]);
    const fulfilled = raceResults.filter((result) => result.status === 'fulfilled');
    const rejected = raceResults.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length, 1, '付款与取消并发时必须且只能有一个操作成功');
    assert.equal(rejected.length, 1, '付款与取消并发时输掉竞争的一方必须失败');

    const finalRaceBatch = await prisma.merchantSettlementBatch.findUniqueOrThrow({
      where: { id: raceBatch.id },
    });
    const finalRaceRecord = await prisma.merchantCommissionRecord.findUniqueOrThrow({
      where: { id: raceRecord.id },
    });
    const finalRaceItems = await prisma.merchantSettlementItem.findMany({
      where: { batchId: raceBatch.id },
    });

    if (finalRaceBatch.status === 'paid') {
      assert.equal(finalRaceRecord.status, 'settled', '付款赢得竞争时分佣必须同步 settled');
      assert.equal(finalRaceItems.length, 1);
      assert.equal(finalRaceItems[0]?.status, 'settled', '付款赢得竞争时批次明细必须 settled');
    } else {
      assert.equal(finalRaceBatch.status, 'cancelled', '取消赢得竞争时批次只能进入 cancelled');
      assert.equal(finalRaceRecord.status, 'pending', '取消赢得竞争时分佣必须恢复原 pending');
      assert.equal(finalRaceItems.length, 0, '取消赢得竞争时必须释放唯一明细占用');
    }

    console.log('[merchant-settlement-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[merchant-settlement-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
