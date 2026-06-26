import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate } from '@baby-mall/shared';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';

const VERIFY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VERIFY_CODE_LENGTH = 8;

function cleanId(v: any): bigint | null {
  if (v === undefined || v === null || v === '') return null;
  return BigInt(v);
}

function toInt(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

@Injectable()
export class BenefitPackageService {
  private readonly logger = new Logger(BenefitPackageService.name);

  constructor(
    private prisma: PrismaService,
    private merchantSettlementService: MerchantSettlementService,
  ) {}

  // ============ 后台：权益包配置 ============

  async findAllAdmin(query: {
    page: number;
    pageSize: number;
    keyword?: string;
    status?: number;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.BenefitPackageWhereInput = { deletedAt: null };
    if (query.keyword) where.name = { contains: query.keyword };
    if (query.status !== undefined) where.status = query.status;
    const [list, total] = await Promise.all([
      this.prisma.benefitPackage.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.benefitPackage.count({ where }),
    ]);
    const enriched = await Promise.all(
      list.map(async (p) => {
        const itemCount = await this.prisma.benefitPackageItem.count({
          where: { packageId: p.id, deletedAt: null },
        });
        return { ...p, itemCount };
      }),
    );
    return paginate(enriched, total, page, pageSize);
  }

  async findById(id: string) {
    const pkg = await this.prisma.benefitPackage.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!pkg) throw new NotFoundException('权益包不存在');
    const items = await this.prisma.benefitPackageItem.findMany({
      where: { packageId: pkg.id, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return { ...pkg, items };
  }

  async create(data: any) {
    const productId = cleanId(data.productId);
    if (productId) {
      const conflict = await this.prisma.benefitPackage.findFirst({
        where: { productId, deletedAt: null },
      });
      if (conflict) {
        throw new BadRequestException(
          `商品已绑定权益包：${conflict.id}`,
        );
      }
    }
    const pkg = await this.prisma.benefitPackage.create({
      data: {
        productId,
        name: data.name,
        subtitle: data.subtitle ?? null,
        coverImage: data.coverImage ?? null,
        description: data.description ?? null,
        price: toInt(data.price) ?? null,
        validDays: toInt(data.validDays),
        validStartAt: data.validStartAt ? new Date(data.validStartAt) : null,
        validEndAt: data.validEndAt ? new Date(data.validEndAt) : null,
        status: toInt(data.status) ?? 0,
        sortOrder: toInt(data.sortOrder) ?? 0,
      },
    });
    if (Array.isArray(data.items)) {
      await this.syncItems(pkg.id, data.items);
    }
    this.logger.log(`创建权益包：${pkg.id}`);
    return this.findById(pkg.id.toString());
  }

  async update(id: string, data: any) {
    const pkg = await this.prisma.benefitPackage.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!pkg) throw new NotFoundException('权益包不存在');

    const productId = data.productId !== undefined ? cleanId(data.productId) : undefined;
    if (productId) {
      const conflict = await this.prisma.benefitPackage.findFirst({
        where: { productId, deletedAt: null, id: { not: pkg.id } },
      });
      if (conflict) {
        throw new BadRequestException(`商品已绑定权益包：${conflict.id}`);
      }
    }

    const updateData: Prisma.BenefitPackageUpdateInput = {};
    if (productId !== undefined) updateData.productId = productId;
    const fields: (keyof Prisma.BenefitPackageUpdateInput)[] = [
      'name',
      'subtitle',
      'coverImage',
      'description',
      'price',
      'validDays',
      'validStartAt',
      'validEndAt',
      'status',
      'sortOrder',
    ];
    for (const f of fields) {
      if (data[f] !== undefined) {
        (updateData as any)[f] =
          f === 'price' || f === 'validDays' || f === 'status' || f === 'sortOrder'
            ? toInt(data[f])
            : f === 'validStartAt' || f === 'validEndAt'
            ? data[f]
              ? new Date(data[f])
              : null
            : data[f];
      }
    }
    if (Object.keys(updateData).length > 0) {
      await this.prisma.benefitPackage.update({ where: { id: pkg.id }, data: updateData });
    }
    if (Array.isArray(data.items)) {
      await this.syncItems(pkg.id, data.items);
    }
    this.logger.log(`更新权益包：${id}`);
    return this.findById(id);
  }

  async updateStatus(id: string, status: number) {
    const pkg = await this.prisma.benefitPackage.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!pkg) throw new NotFoundException('权益包不存在');
    await this.prisma.benefitPackage.update({
      where: { id: pkg.id },
      data: { status },
    });
    this.logger.log(`更新权益包状态：${id} -> ${status}`);
    return this.findById(id);
  }

  async delete(id: string) {
    const pkg = await this.prisma.benefitPackage.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!pkg) throw new NotFoundException('权益包不存在');
    await this.prisma.$transaction([
      this.prisma.benefitPackageItem.updateMany({
        where: { packageId: pkg.id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.benefitPackage.update({
        where: { id: pkg.id },
        data: { deletedAt: new Date() },
      }),
    ]);
    this.logger.log(`删除权益包：${id}`);
    return { id };
  }

  private async syncItems(packageId: bigint, items: any[]) {
    const existing = await this.prisma.benefitPackageItem.findMany({
      where: { packageId, deletedAt: null },
    });
    const incomingIds = new Set(
      items.filter((i) => i.id).map((i) => String(i.id)),
    );
    // 软删除被移除的项
    const toRemove = existing.filter((e) => !incomingIds.has(e.id.toString()));
    if (toRemove.length > 0) {
      await this.prisma.benefitPackageItem.updateMany({
        where: { id: { in: toRemove.map((e) => e.id) } },
        data: { deletedAt: new Date() },
      });
    }
    // 更新或新建
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const payload = {
        packageId,
        merchantPromotionSourceId: cleanId(it.merchantPromotionSourceId),
        pickupStoreId: cleanId(it.pickupStoreId),
        name: it.name,
        itemType: it.itemType || 'service',
        description: it.description ?? null,
        quantity: toInt(it.quantity) ?? 1,
        originalValue: toInt(it.originalValue),
        verifyRequired: toInt(it.verifyRequired) ?? 1,
        status: toInt(it.status) ?? 1,
        sortOrder: toInt(it.sortOrder) ?? idx,
      };
      if (it.id) {
        await this.prisma.benefitPackageItem.update({
          where: { id: BigInt(it.id) },
          data: payload,
        });
      } else {
        await this.prisma.benefitPackageItem.create({ data: payload });
      }
    }
  }

  // ============ 后台：用户权益 / 核销 ============

  async findUserPackages(query: {
    page: number;
    pageSize: number;
    userId?: string;
    packageId?: string;
    orderId?: string;
    phone?: string;
    status?: string;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.UserBenefitPackageWhereInput = { deletedAt: null };
    if (query.userId) where.userId = BigInt(query.userId);
    if (query.packageId) where.packageId = BigInt(query.packageId);
    if (query.orderId) where.orderId = BigInt(query.orderId);
    if (query.status) where.status = query.status;
    if (query.phone) {
      const users = await this.prisma.user.findMany({
        where: { phone: { contains: query.phone } },
        select: { id: true },
      });
      where.userId = { in: users.map((u) => u.id) };
    }
    const [list, total] = await Promise.all([
      this.prisma.userBenefitPackage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userBenefitPackage.count({ where }),
    ]);
    const enriched = await Promise.all(
      list.map(async (up) => this.enrichUserPackage(up)),
    );
    return paginate(enriched, total, page, pageSize);
  }

  private async enrichUserPackage(up: any) {
    const [pkg, user, entCount, usedCount] = await Promise.all([
      this.prisma.benefitPackage.findFirst({ where: { id: up.packageId } }),
      this.prisma.user.findFirst({
        where: { id: up.userId },
        select: { id: true, nickname: true, phone: true },
      }),
      this.prisma.userBenefitEntitlement.count({
        where: { userBenefitPackageId: up.id, deletedAt: null },
      }),
      this.prisma.userBenefitEntitlement.count({
        where: { userBenefitPackageId: up.id, status: 'used', deletedAt: null },
      }),
    ]);
    return {
      ...up,
      packageName: pkg?.name ?? null,
      coverImage: pkg?.coverImage ?? null,
      nickname: user?.nickname ?? null,
      phone: user?.phone ?? null,
      entitlementTotal: entCount,
      entitlementUsed: usedCount,
    };
  }

  async findEntitlements(query: {
    page: number;
    pageSize: number;
    userId?: string;
    packageId?: string;
    packageItemId?: string;
    verifyCode?: string;
    phone?: string;
    status?: string;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.UserBenefitEntitlementWhereInput = { deletedAt: null };
    if (query.userId) where.userId = BigInt(query.userId);
    if (query.packageItemId) where.packageItemId = BigInt(query.packageItemId);
    if (query.verifyCode) where.verifyCode = { contains: query.verifyCode.toUpperCase() };
    if (query.status) where.status = query.status;
    if (query.packageId) {
      const userPkgs = await this.prisma.userBenefitPackage.findMany({
        where: { packageId: BigInt(query.packageId), deletedAt: null },
        select: { id: true },
      });
      where.userBenefitPackageId = { in: userPkgs.map((up) => up.id) };
    }
    if (query.phone) {
      const users = await this.prisma.user.findMany({
        where: { phone: { contains: query.phone } },
        select: { id: true },
      });
      where.userId = { in: users.map((u) => u.id) };
    }
    const [list, total] = await Promise.all([
      this.prisma.userBenefitEntitlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userBenefitEntitlement.count({ where }),
    ]);
    const enriched = await Promise.all(list.map((e) => this.enrichEntitlement(e)));
    return paginate(enriched, total, page, pageSize);
  }

  private async enrichEntitlement(e: any) {
    const [userPkg, item, user] = await Promise.all([
      this.prisma.userBenefitPackage.findFirst({
        where: { id: e.userBenefitPackageId },
      }),
      this.prisma.benefitPackageItem.findFirst({
        where: { id: e.packageItemId },
      }),
      this.prisma.user.findFirst({
        where: { id: e.userId },
        select: { id: true, nickname: true, phone: true },
      }),
    ]);
    let pkg: any = null;
    if (userPkg) {
      pkg = await this.prisma.benefitPackage.findFirst({
        where: { id: userPkg.packageId },
      });
    }
    return {
      ...e,
      packageName: pkg?.name ?? null,
      itemName: item?.name ?? null,
      itemType: item?.itemType ?? null,
      originalValue: item?.originalValue ?? null,
      nickname: user?.nickname ?? null,
      phone: user?.phone ?? null,
      validTo: userPkg?.validTo ?? null,
    };
  }

  async previewVerify(verifyCode: string) {
    const code = (verifyCode || '').trim().toUpperCase();
    const entitlement = await this.prisma.userBenefitEntitlement.findFirst({
      where: { verifyCode: code, deletedAt: null },
    });
    if (!entitlement) throw new NotFoundException('权益码不存在');

    const [userPkg, user] = await Promise.all([
      this.prisma.userBenefitPackage.findFirst({
        where: { id: entitlement.userBenefitPackageId, deletedAt: null },
      }),
      this.prisma.user.findFirst({
        where: { id: entitlement.userId },
        select: { id: true, nickname: true, phone: true },
      }),
    ]);
    // 权益项按 id 查询，忽略 deletedAt，保证已发放权益在编辑后仍可核销
    const item = await this.prisma.benefitPackageItem.findFirst({
      where: { id: entitlement.packageItemId },
    });
    let pkg: any = null;
    if (userPkg) {
      pkg = await this.prisma.benefitPackage.findFirst({
        where: { id: userPkg.packageId },
      });
    }
    const merchant =
      item?.merchantPromotionSourceId != null
        ? await this.prisma.merchantPromotionSource.findFirst({
            where: { id: item.merchantPromotionSourceId },
          })
        : null;
    const store =
      item?.pickupStoreId != null
        ? await this.prisma.pickupStore.findFirst({
            where: { id: item.pickupStoreId },
          })
        : null;

    const now = new Date();
    let canVerify = true;
    let reason = '';
    if (entitlement.status !== 'unused') {
      canVerify = false;
      reason =
        entitlement.status === 'used'
          ? '该权益已被核销'
          : `权益状态为${entitlement.status}`;
    } else if (!userPkg) {
      canVerify = false;
      reason = '权益包不存在';
    } else if (userPkg.status !== 'active') {
      canVerify = false;
      reason = `权益包状态为${userPkg.status}`;
    } else if (userPkg.validTo && userPkg.validTo < now) {
      canVerify = false;
      reason = '权益已过期';
    } else if (!item) {
      canVerify = false;
      reason = '权益项不存在';
    } else if (item.status !== 1) {
      canVerify = false;
      reason = '权益项已停用';
    } else if (item.verifyRequired !== 1) {
      canVerify = false;
      reason = '该权益项无需核销';
    }

    return {
      entitlementId: entitlement.id,
      verifyCode: code,
      status: entitlement.status,
      usedAt: entitlement.usedAt,
      userId: entitlement.userId,
      nickname: user?.nickname ?? null,
      phone: user?.phone ?? null,
      packageId: userPkg?.packageId ?? null,
      packageName: pkg?.name ?? null,
      packageItemId: entitlement.packageItemId,
      itemName: item?.name ?? null,
      itemType: item?.itemType ?? null,
      originalValue: item?.originalValue ?? null,
      validFrom: userPkg?.validFrom ?? null,
      validTo: userPkg?.validTo ?? null,
      merchantName: merchant?.name ?? null,
      merchantContactPhone: merchant?.contactPhone ?? null,
      storeName: store?.name ?? null,
      storeAddress: store
        ? `${store.province}${store.city}${store.district}${store.address}`
        : null,
      canVerify,
      reason,
    };
  }

  async verify(verifyCode: string, adminId: string, remark?: string) {
    const code = (verifyCode || '').trim().toUpperCase();
    const entitlement = await this.prisma.userBenefitEntitlement.findFirst({
      where: { verifyCode: code, deletedAt: null },
    });
    if (!entitlement) throw new NotFoundException('权益码不存在');
    if (entitlement.status === 'used') {
      throw new BadRequestException('该权益已被核销，请勿重复核销');
    }

    const userPkg = await this.prisma.userBenefitPackage.findFirst({
      where: { id: entitlement.userBenefitPackageId, deletedAt: null },
    });
    if (!userPkg) throw new BadRequestException('权益包不存在');
    if (userPkg.status !== 'active') {
      throw new BadRequestException(`权益包状态为${userPkg.status}，不可核销`);
    }
    if (userPkg.validTo && userPkg.validTo < new Date()) {
      throw new BadRequestException('权益已过期，不可核销');
    }
    const item = await this.prisma.benefitPackageItem.findFirst({
      where: { id: entitlement.packageItemId },
    });
    if (!item) throw new BadRequestException('权益项不存在');
    if (item.status !== 1) throw new BadRequestException('权益项已停用');
    if (item.verifyRequired !== 1) {
      throw new BadRequestException('该权益项无需核销');
    }

    // 抢占式更新，防止并发重复核销
    const now = new Date();
    const claim = await this.prisma.userBenefitEntitlement.updateMany({
      where: { id: entitlement.id, status: 'unused' },
      data: {
        status: 'used',
        usedAt: now,
        verifiedByAdminId: BigInt(adminId),
        verifyRemark: remark ?? null,
      },
    });
    if (claim.count === 0) {
      throw new BadRequestException('核销失败：该权益可能已被核销');
    }

    const verificationLog = await this.prisma.userBenefitVerificationLog.create({
      data: {
        entitlementId: entitlement.id,
        userId: entitlement.userId,
        packageId: userPkg.packageId,
        packageItemId: entitlement.packageItemId,
        verifyCode: code,
        verifierType: 'admin',
        verifierId: BigInt(adminId),
        action: 'verify',
        remark: remark ?? null,
      },
    });
    this.logger.log(`权益核销成功：code=${code}, admin=${adminId}`);

    // 服务结算生成：根据权益项/商家/门店规则入账，失败不影响核销主流程
    try {
      await this.merchantSettlementService.generateServiceCommission(
        verificationLog.id,
        entitlement.id,
        entitlement.packageItemId,
        userPkg.packageId,
        item.pickupStoreId,
        item.merchantPromotionSourceId,
      );
    } catch (err) {
      this.logger.error(
        `服务结算生成失败: verificationLogId=${verificationLog.id}`,
        (err as Error).message,
      );
    }

    return {
      entitlementId: entitlement.id,
      verifyCode: code,
      usedAt: now,
    };
  }

  async findVerificationLogs(query: {
    page: number;
    pageSize: number;
    userId?: string;
    packageId?: string;
    verifyCode?: string;
    verifierId?: string;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.UserBenefitVerificationLogWhereInput = {};
    if (query.userId) where.userId = BigInt(query.userId);
    if (query.packageId) where.packageId = BigInt(query.packageId);
    if (query.verifyCode) where.verifyCode = { contains: query.verifyCode.toUpperCase() };
    if (query.verifierId) where.verifierId = BigInt(query.verifierId);
    const [list, total] = await Promise.all([
      this.prisma.userBenefitVerificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userBenefitVerificationLog.count({ where }),
    ]);
    const enriched = await Promise.all(
      list.map(async (log) => {
        const [user, item, verifier] = await Promise.all([
          this.prisma.user.findFirst({
            where: { id: log.userId },
            select: { id: true, nickname: true, phone: true },
          }),
          this.prisma.benefitPackageItem.findFirst({
            where: { id: log.packageItemId },
            select: { name: true },
          }),
          log.verifierId
            ? this.prisma.adminUser.findFirst({
                where: { id: log.verifierId },
                select: { id: true, username: true, realName: true },
              })
            : null,
        ]);
        return {
          ...log,
          nickname: user?.nickname ?? null,
          phone: user?.phone ?? null,
          itemName: item?.name ?? null,
          verifierName: verifier?.realName || verifier?.username || null,
        };
      }),
    );
    return paginate(enriched, total, page, pageSize);
  }

  async getStats() {
    const [
      packageCount,
      userPackageCount,
      entitlementTotal,
      entitlementUsed,
      entitlementUnused,
      entitlementExpired,
      verifyLogCount,
    ] = await Promise.all([
      this.prisma.benefitPackage.count({ where: { deletedAt: null, status: 1 } }),
      this.prisma.userBenefitPackage.count({ where: { deletedAt: null } }),
      this.prisma.userBenefitEntitlement.count({ where: { deletedAt: null } }),
      this.prisma.userBenefitEntitlement.count({
        where: { deletedAt: null, status: 'used' },
      }),
      this.prisma.userBenefitEntitlement.count({
        where: { deletedAt: null, status: 'unused' },
      }),
      this.prisma.userBenefitEntitlement.count({
        where: { deletedAt: null, status: 'expired' },
      }),
      this.prisma.userBenefitVerificationLog.count(),
    ]);

    // 按门店 / 商家核销数量
    const usedEntitlements = await this.prisma.userBenefitEntitlement.findMany({
      where: { status: 'used', deletedAt: null },
      select: { packageItemId: true },
    });
    const itemIds = Array.from(new Set(usedEntitlements.map((e) => e.packageItemId)));
    const items = await this.prisma.benefitPackageItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, merchantPromotionSourceId: true, pickupStoreId: true },
    });
    const itemMap = new Map(items.map((i) => [i.id.toString(), i]));
    const byStore = new Map<string, { name: string; count: number }>();
    const byMerchant = new Map<string, { name: string; count: number }>();
    for (const e of usedEntitlements) {
      const it = itemMap.get(e.packageItemId.toString());
      if (!it) continue;
      if (it.pickupStoreId) {
        const key = it.pickupStoreId.toString();
        const cur = byStore.get(key) || { name: `门店${key}`, count: 0 };
        cur.count += 1;
        byStore.set(key, cur);
      }
      if (it.merchantPromotionSourceId) {
        const key = it.merchantPromotionSourceId.toString();
        const cur = byMerchant.get(key) || { name: `商家${key}`, count: 0 };
        cur.count += 1;
        byMerchant.set(key, cur);
      }
    }
    // 补全门店/商家名称
    const storeIds = Array.from(byStore.keys()).map((k) => BigInt(k));
    const merchantIds = Array.from(byMerchant.keys()).map((k) => BigInt(k));
    const [stores, merchants] = await Promise.all([
      storeIds.length
        ? this.prisma.pickupStore.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } })
        : [],
      merchantIds.length
        ? this.prisma.merchantPromotionSource.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
        : [],
    ]);
    stores.forEach((s) => {
      const cur = byStore.get(s.id.toString());
      if (cur) cur.name = s.name;
    });
    merchants.forEach((m) => {
      const cur = byMerchant.get(m.id.toString());
      if (cur) cur.name = m.name;
    });

    return {
      packageCount,
      userPackageCount,
      entitlementTotal,
      entitlementUsed,
      entitlementUnused,
      entitlementExpired,
      verifyLogCount,
      byStore: Array.from(byStore.values()),
      byMerchant: Array.from(byMerchant.values()),
    };
  }

  // ============ 小程序 ============

  async findPublished(page: number, pageSize: number) {
    const where = { deletedAt: null, status: 1 };
    const [list, total] = await Promise.all([
      this.prisma.benefitPackage.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.benefitPackage.count({ where }),
    ]);
    const enriched = await Promise.all(
      list.map(async (p) => {
        const items = await this.prisma.benefitPackageItem.findMany({
          where: { packageId: p.id, deletedAt: null, status: 1 },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, itemType: true, originalValue: true, description: true },
        });
        return { ...p, items };
      }),
    );
    return paginate(enriched, total, page, pageSize);
  }

  async findDetailForWeapp(id: string) {
    const pkg = await this.prisma.benefitPackage.findFirst({
      where: { id: BigInt(id), deletedAt: null, status: 1 },
    });
    if (!pkg) throw new NotFoundException('权益包不存在或已下架');
    const items = await this.prisma.benefitPackageItem.findMany({
      where: { packageId: pkg.id, deletedAt: null, status: 1 },
      orderBy: { sortOrder: 'asc' },
    });
    return { ...pkg, items };
  }

  async findMyPackages(userId: string, page: number, pageSize: number) {
    const where: Prisma.UserBenefitPackageWhereInput = {
      userId: BigInt(userId),
      deletedAt: null,
    };
    const [list, total] = await Promise.all([
      this.prisma.userBenefitPackage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userBenefitPackage.count({ where }),
    ]);
    const enriched = await Promise.all(list.map((up) => this.enrichUserPackage(up)));
    return paginate(enriched, total, page, pageSize);
  }

  async findMyEntitlements(userId: string, page: number, pageSize: number) {
    const where: Prisma.UserBenefitEntitlementWhereInput = {
      userId: BigInt(userId),
      deletedAt: null,
    };
    const [list, total] = await Promise.all([
      this.prisma.userBenefitEntitlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userBenefitEntitlement.count({ where }),
    ]);
    const enriched = await Promise.all(list.map((e) => this.enrichEntitlement(e)));
    return paginate(enriched, total, page, pageSize);
  }

  async findEntitlementForUser(userId: string, id: string) {
    const entitlement = await this.prisma.userBenefitEntitlement.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!entitlement) throw new NotFoundException('权益不存在');
    const enriched = await this.enrichEntitlement(entitlement);
    // 补充门店 / 商家信息
    const item = await this.prisma.benefitPackageItem.findFirst({
      where: { id: entitlement.packageItemId },
    });
    let merchant: any = null;
    let store: any = null;
    if (item?.merchantPromotionSourceId) {
      merchant = await this.prisma.merchantPromotionSource.findFirst({
        where: { id: item.merchantPromotionSourceId },
        select: { id: true, name: true, contactPhone: true },
      });
    }
    if (item?.pickupStoreId) {
      store = await this.prisma.pickupStore.findFirst({
        where: { id: item.pickupStoreId },
        select: {
          id: true,
          name: true,
          contactPhone: true,
          province: true,
          city: true,
          district: true,
          address: true,
          businessHours: true,
        },
      });
    }
    return {
      ...enriched,
      merchantName: merchant?.name ?? null,
      merchantContactPhone: merchant?.contactPhone ?? null,
      storeName: store?.name ?? null,
      storeAddress: store
        ? `${store.province}${store.city}${store.district}${store.address}`
        : null,
      storePhone: store?.contactPhone ?? null,
      businessHours: store?.businessHours ?? null,
    };
  }

  // ============ 权益发放（支付成功后挂接） ============

  /**
   * 幂等发放：同一 orderItem+unit+package 只发放一次
   * 失败不抛出到主流程，仅记录错误日志
   */
  async grantBenefitsForOrder(orderId: string | bigint, userId: string | bigint) {
    const oid = BigInt(orderId);
    try {
      const order = await this.prisma.order.findFirst({
        where: { id: oid },
        include: { orderItems: true },
      });
      if (!order) {
        this.logger.warn(`权益发放跳过：订单不存在 orderId=${orderId}`);
        return;
      }

      for (const item of order.orderItems) {
        const pkg = await this.prisma.benefitPackage.findFirst({
          where: { productId: item.productId, deletedAt: null },
        });
        if (!pkg) continue;

        const qty = item.quantity > 0 ? item.quantity : 1;
        for (let i = 0; i < qty; i++) {
          const grantKey = `order_item:${item.id}:unit:${i}:package:${pkg.id}`;
          await this.grantOnePackage(pkg, BigInt(userId), oid, item.id, grantKey);
        }
      }
    } catch (err) {
      this.logger.error(
        `权益发放失败 orderId=${orderId}`,
        (err as Error)?.message,
      );
    }
  }

  private async grantOnePackage(
    pkg: any,
    userId: bigint,
    orderId: bigint,
    orderItemId: bigint,
    grantKey: string,
  ) {
    const existing = await this.prisma.userBenefitPackage.findUnique({
      where: { grantKey },
    });
    if (existing) {
      this.logger.log(`权益包已发放，幂等跳过：${grantKey}`);
      return;
    }

    const now = new Date();
    const validFrom = now;
    let validTo: Date | null = pkg.validEndAt ?? null;
    if (!validTo && pkg.validDays) {
      validTo = new Date(now.getTime() + pkg.validDays * 24 * 60 * 60 * 1000);
    }

    try {
      const userPkg = await this.prisma.userBenefitPackage.create({
        data: {
          userId,
          packageId: pkg.id,
          orderId,
          orderItemId,
          grantKey,
          status: 'active',
          validFrom,
          validTo,
        },
      });

      const items = await this.prisma.benefitPackageItem.findMany({
        where: { packageId: pkg.id, deletedAt: null, status: 1 },
        orderBy: { sortOrder: 'asc' },
      });
      for (const it of items) {
        const count = it.quantity > 0 ? it.quantity : 1;
        for (let j = 0; j < count; j++) {
          await this.createEntitlementWithRetry(userPkg.id, userId, it.id);
        }
      }
      this.logger.log(
        `权益包发放成功：user=${userId}, package=${pkg.id}, userPackage=${userPkg.id}`,
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.log(`权益包发放幂等跳过（grantKey冲突）：${grantKey}`);
        return;
      }
      throw e;
    }
  }

  private async createEntitlementWithRetry(
    userBenefitPackageId: bigint,
    userId: bigint,
    packageItemId: bigint,
    maxRetries = 5,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const verifyCode = this.generateVerifyCode();
      try {
        return await this.prisma.userBenefitEntitlement.create({
          data: {
            userBenefitPackageId,
            userId,
            packageItemId,
            verifyCode,
            status: 'unused',
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < maxRetries - 1
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new InternalServerErrorException('权益核销码生成失败');
  }

  private generateVerifyCode(): string {
    let code = '';
    for (let i = 0; i < VERIFY_CODE_LENGTH; i++) {
      code += VERIFY_CODE_CHARS[Math.floor(Math.random() * VERIFY_CODE_CHARS.length)];
    }
    return code;
  }
}
