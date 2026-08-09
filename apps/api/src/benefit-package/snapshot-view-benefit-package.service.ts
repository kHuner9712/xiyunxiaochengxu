import { Injectable } from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { VersionedBenefitPackageService } from './versioned-benefit-package.service';

const USER_PACKAGE_SNAPSHOT_EVENT = 'benefit_user_package_snapshot';
const ENTITLEMENT_SNAPSHOT_EVENT = 'benefit_entitlement_snapshot';
const USER_PACKAGE_BIZ_TYPE = 'benefit_user_package';
const ENTITLEMENT_BIZ_TYPE = 'benefit_entitlement';

type SnapshotPackage = {
  id: string;
  name: string;
  subtitle: string | null;
  coverImage: string | null;
  items?: SnapshotItem[];
};

type SnapshotItem = {
  id: string;
  name: string;
  itemType: string;
  description: string | null;
  originalValue: number | null;
  merchantPromotionSourceId: string | null;
  pickupStoreId: string | null;
};

@Injectable()
export class SnapshotViewBenefitPackageService extends VersionedBenefitPackageService {
  constructor(
    private readonly viewPrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(viewPrisma, merchantSettlementService);
  }

  override async findUserPackages(query: Parameters<VersionedBenefitPackageService['findUserPackages']>[0]) {
    const result: any = await super.findUserPackages(query);
    return {
      ...result,
      list: await Promise.all(
        (result.list ?? []).map((row: any) => this.overlayUserPackageSnapshot(row)),
      ),
    };
  }

  override async findMyPackages(userId: string, page: number, pageSize: number) {
    const result: any = await super.findMyPackages(userId, page, pageSize);
    return {
      ...result,
      list: await Promise.all(
        (result.list ?? []).map((row: any) => this.overlayUserPackageSnapshot(row, true)),
      ),
    };
  }

  override async findEntitlements(query: Parameters<VersionedBenefitPackageService['findEntitlements']>[0]) {
    const result: any = await super.findEntitlements(query);
    return {
      ...result,
      list: await Promise.all(
        (result.list ?? []).map((row: any) => this.overlayEntitlementSnapshot(row)),
      ),
    };
  }

  override async findMyEntitlements(userId: string, page: number, pageSize: number) {
    const result: any = await super.findMyEntitlements(userId, page, pageSize);
    return {
      ...result,
      list: await Promise.all(
        (result.list ?? []).map((row: any) => this.overlayEntitlementSnapshot(row)),
      ),
    };
  }

  override async findEntitlementForUser(userId: string, id: string) {
    const row: any = await super.findEntitlementForUser(userId, id);
    return this.overlayEntitlementSnapshot(row, true);
  }

  override async findVerificationLogs(query: Parameters<VersionedBenefitPackageService['findVerificationLogs']>[0]) {
    const result: any = await super.findVerificationLogs(query);
    return {
      ...result,
      list: await Promise.all(
        (result.list ?? []).map(async (row: any) => {
          const entitlementId = row.entitlementId?.toString?.() ?? String(row.entitlementId ?? '');
          if (!entitlementId) return row;
          const snapshot = await this.loadEntitlementSnapshot(entitlementId);
          return snapshot?.item
            ? {
                ...row,
                itemName: snapshot.item.name,
              }
            : row;
        }),
      ),
    };
  }

  override async getStats() {
    const base: any = await super.getStats();
    const usedEntitlements = await this.viewPrisma.userBenefitEntitlement.findMany({
      where: { status: 'used', deletedAt: null },
      select: { id: true, packageItemId: true },
    });

    const currentItemIds = Array.from(
      new Set(usedEntitlements.map((row) => row.packageItemId.toString())),
    ).map((id) => BigInt(id));
    const currentItems = currentItemIds.length
      ? await this.viewPrisma.benefitPackageItem.findMany({
          where: { id: { in: currentItemIds } },
          select: { id: true, merchantPromotionSourceId: true, pickupStoreId: true },
        })
      : [];
    const currentItemMap = new Map(currentItems.map((item) => [item.id.toString(), item]));

    const byStore = new Map<string, number>();
    const byMerchant = new Map<string, number>();
    for (const entitlement of usedEntitlements) {
      const snapshot = await this.loadEntitlementSnapshot(entitlement.id.toString());
      const current = currentItemMap.get(entitlement.packageItemId.toString());
      const storeId = snapshot?.item?.pickupStoreId ?? current?.pickupStoreId?.toString() ?? null;
      const merchantId = snapshot?.item?.merchantPromotionSourceId
        ?? current?.merchantPromotionSourceId?.toString()
        ?? null;
      if (storeId) byStore.set(storeId, (byStore.get(storeId) ?? 0) + 1);
      if (merchantId) byMerchant.set(merchantId, (byMerchant.get(merchantId) ?? 0) + 1);
    }

    const storeIds = [...byStore.keys()].map((id) => BigInt(id));
    const merchantIds = [...byMerchant.keys()].map((id) => BigInt(id));
    const [stores, merchants] = await Promise.all([
      storeIds.length
        ? this.viewPrisma.pickupStore.findMany({
            where: { id: { in: storeIds } },
            select: { id: true, name: true },
          })
        : [],
      merchantIds.length
        ? this.viewPrisma.merchantPromotionSource.findMany({
            where: { id: { in: merchantIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const storeNameMap = new Map(stores.map((store) => [store.id.toString(), store.name]));
    const merchantNameMap = new Map(
      merchants.map((merchant) => [merchant.id.toString(), merchant.name]),
    );

    return {
      ...base,
      byStore: [...byStore.entries()].map(([id, count]) => ({
        name: storeNameMap.get(id) ?? `门店${id}`,
        count,
      })),
      byMerchant: [...byMerchant.entries()].map(([id, count]) => ({
        name: merchantNameMap.get(id) ?? `商家${id}`,
        count,
      })),
    };
  }

  private async overlayUserPackageSnapshot(row: any, mini = false) {
    const userPackageId = row.id?.toString?.() ?? String(row.id ?? '');
    if (!userPackageId) return row;
    const pkg = await this.loadUserPackageSnapshot(userPackageId);
    if (!pkg) return row;
    return {
      ...row,
      packageName: pkg.name,
      coverImage: pkg.coverImage,
      ...(mini ? { packageCoverImage: pkg.coverImage } : {}),
    };
  }

  private async overlayEntitlementSnapshot(row: any, detail = false) {
    const entitlementId = row.id?.toString?.() ?? String(row.id ?? '');
    if (!entitlementId) return row;
    const snapshot = await this.loadEntitlementSnapshot(entitlementId);
    if (!snapshot?.item) return row;

    const packageId = row.userBenefitPackageId
      ? await this.loadPackageForUserPackage(
          row.userBenefitPackageId?.toString?.() ?? String(row.userBenefitPackageId),
        )
      : null;
    const pkg = packageId ?? snapshot.package;
    const item = snapshot.item;
    const base = {
      ...row,
      packageName: pkg?.name ?? row.packageName ?? null,
      itemName: item.name,
      itemType: item.itemType,
      originalValue: item.originalValue,
      pickupStoreId: item.pickupStoreId,
      merchantPromotionSourceId: item.merchantPromotionSourceId,
    };
    if (!detail) return base;

    const [merchant, store] = await Promise.all([
      item.merchantPromotionSourceId
        ? this.viewPrisma.merchantPromotionSource.findFirst({
            where: { id: BigInt(item.merchantPromotionSourceId) },
            select: { id: true, name: true, contactPhone: true },
          })
        : null,
      item.pickupStoreId
        ? this.viewPrisma.pickupStore.findFirst({
            where: { id: BigInt(item.pickupStoreId) },
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
          })
        : null,
    ]);
    return {
      ...base,
      packageSubtitle: pkg?.subtitle ?? row.packageSubtitle ?? null,
      itemDescription: item.description,
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

  private async loadPackageForUserPackage(userPackageId: string) {
    return this.loadUserPackageSnapshot(userPackageId);
  }

  private async loadUserPackageSnapshot(userPackageId: string): Promise<SnapshotPackage | null> {
    const event = await this.viewPrisma.businessEvent.findFirst({
      where: {
        eventType: USER_PACKAGE_SNAPSHOT_EVENT,
        bizType: USER_PACKAGE_BIZ_TYPE,
        bizId: userPackageId,
      },
      orderBy: { createdAt: 'asc' },
    });
    const payload = (event?.payload ?? {}) as Record<string, any>;
    return this.parsePackage(payload.package);
  }

  private async loadEntitlementSnapshot(
    entitlementId: string,
  ): Promise<{ package: SnapshotPackage | null; item: SnapshotItem | null } | null> {
    const event = await this.viewPrisma.businessEvent.findFirst({
      where: {
        eventType: ENTITLEMENT_SNAPSHOT_EVENT,
        bizType: ENTITLEMENT_BIZ_TYPE,
        bizId: entitlementId,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!event) return null;
    const payload = (event.payload ?? {}) as Record<string, any>;
    const item = this.parseItem(payload.item);
    let pkg: SnapshotPackage | null = null;
    if (payload.package && typeof payload.package === 'object') {
      pkg = this.parsePackage(payload.package);
    }
    return { package: pkg, item };
  }

  private parsePackage(value: unknown): SnapshotPackage | null {
    if (!value || typeof value !== 'object') return null;
    const pkg = value as Record<string, any>;
    if (!pkg.id) return null;
    return {
      id: String(pkg.id),
      name: String(pkg.name ?? ''),
      subtitle: pkg.subtitle == null ? null : String(pkg.subtitle),
      coverImage: pkg.coverImage == null ? null : String(pkg.coverImage),
      items: Array.isArray(pkg.items)
        ? pkg.items.map((item) => this.parseItem(item)).filter((item): item is SnapshotItem => !!item)
        : [],
    };
  }

  private parseItem(value: unknown): SnapshotItem | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, any>;
    if (!item.id) return null;
    return {
      id: String(item.id),
      name: String(item.name ?? ''),
      itemType: String(item.itemType ?? 'service'),
      description: item.description == null ? null : String(item.description),
      originalValue: item.originalValue == null ? null : Number(item.originalValue),
      merchantPromotionSourceId: item.merchantPromotionSourceId == null
        ? null
        : String(item.merchantPromotionSourceId),
      pickupStoreId: item.pickupStoreId == null ? null : String(item.pickupStoreId),
    };
  }
}
