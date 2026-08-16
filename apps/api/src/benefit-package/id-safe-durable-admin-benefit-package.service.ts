import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { DurableAdminBenefitPackageService } from './durable-admin-benefit-package.service';

@Injectable()
export class IdSafeDurableAdminBenefitPackageService extends DurableAdminBenefitPackageService {
  constructor(
    prisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(prisma, merchantSettlementService);
  }

  override async findById(id: string) {
    const packageId = parsePositiveBigIntId(id, '权益包');
    return super.findById(packageId.toString());
  }

  override async findDetailForWeapp(id: string) {
    const packageId = parsePositiveBigIntId(id, '权益包');
    return super.findDetailForWeapp(packageId.toString());
  }

  override async findEntitlementForUser(userId: string, id: string) {
    const safeUserId = parsePositiveBigIntId(userId, '用户');
    const entitlementId = parsePositiveBigIntId(id, '权益');
    return super.findEntitlementForUser(safeUserId.toString(), entitlementId.toString());
  }

  override async findMyPackages(userId: string, page: number, pageSize: number) {
    const safeUserId = parsePositiveBigIntId(userId, '用户');
    return super.findMyPackages(safeUserId.toString(), page, pageSize);
  }

  override async findMyEntitlements(userId: string, page: number, pageSize: number) {
    const safeUserId = parsePositiveBigIntId(userId, '用户');
    return super.findMyEntitlements(safeUserId.toString(), page, pageSize);
  }

  override async findUserPackages(query: Parameters<DurableAdminBenefitPackageService['findUserPackages']>[0]) {
    return super.findUserPackages({
      ...query,
      ...(query.userId ? { userId: parsePositiveBigIntId(query.userId, '用户').toString() } : {}),
      ...(query.packageId ? { packageId: parsePositiveBigIntId(query.packageId, '权益包').toString() } : {}),
      ...(query.orderId ? { orderId: parsePositiveBigIntId(query.orderId, '订单').toString() } : {}),
    });
  }

  override async findEntitlements(query: Parameters<DurableAdminBenefitPackageService['findEntitlements']>[0]) {
    return super.findEntitlements({
      ...query,
      ...(query.userId ? { userId: parsePositiveBigIntId(query.userId, '用户').toString() } : {}),
      ...(query.packageId ? { packageId: parsePositiveBigIntId(query.packageId, '权益包').toString() } : {}),
      ...(query.packageItemId
        ? { packageItemId: parsePositiveBigIntId(query.packageItemId, '权益项').toString() }
        : {}),
    });
  }

  override async findVerificationLogs(
    query: Parameters<DurableAdminBenefitPackageService['findVerificationLogs']>[0],
  ) {
    return super.findVerificationLogs({
      ...query,
      ...(query.userId ? { userId: parsePositiveBigIntId(query.userId, '用户').toString() } : {}),
      ...(query.packageId ? { packageId: parsePositiveBigIntId(query.packageId, '权益包').toString() } : {}),
      ...(query.verifierId
        ? { verifierId: parsePositiveBigIntId(query.verifierId, '核销员').toString() }
        : {}),
    });
  }
}
