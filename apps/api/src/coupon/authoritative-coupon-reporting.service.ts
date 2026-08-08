import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { COUPON_STATUS } from '../common/constants/payment';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ReferentiallySafeCouponService } from './referentially-safe-coupon.service';

@Injectable()
export class AuthoritativeCouponReportingService extends ReferentiallySafeCouponService {
  constructor(private readonly reportingPrisma: PrismaService) {
    super(reportingPrisma);
  }

  override async findAllAdmin(dto: CouponQueryDto) {
    const result: any = await super.findAllAdmin(dto);
    const list = Array.isArray(result?.list) ? result.list : [];
    return { ...result, list: await this.attachAuthoritativeUsedCounts(list) };
  }

  override async findById(id: string) {
    return this.attachAuthoritativeUsedCount(await super.findById(id));
  }

  override async update(id: string, dto: UpdateCouponDto) {
    return this.attachAuthoritativeUsedCount(await super.update(id, dto));
  }

  override async delete(id: string) {
    const result: any = await super.delete(id);
    if (result?.deleted) return { ...result, usedCount: 0 };
    return this.attachAuthoritativeUsedCount(result);
  }

  private async attachAuthoritativeUsedCount<T extends Record<string, any>>(coupon: T): Promise<T> {
    const couponId = parsePositiveBigIntId(coupon.id, '优惠券');
    const usedCount = await this.reportingPrisma.userCoupon.count({
      where: { couponId, status: COUPON_STATUS.USED },
    });
    return { ...coupon, usedCount };
  }

  private async attachAuthoritativeUsedCounts<T extends Record<string, any>>(coupons: T[]): Promise<T[]> {
    if (coupons.length === 0) return coupons;

    const couponIds = Array.from(new Set(coupons.map((coupon) =>
      parsePositiveBigIntId(coupon.id, '优惠券').toString(),
    ))).map((id) => BigInt(id));

    const rows = await this.reportingPrisma.userCoupon.groupBy({
      by: ['couponId'],
      where: { couponId: { in: couponIds }, status: COUPON_STATUS.USED },
      _count: { _all: true },
    });
    const usedCountByCoupon = new Map(
      rows.map((row) => [row.couponId.toString(), row._count._all]),
    );

    return coupons.map((coupon) => ({
      ...coupon,
      usedCount: usedCountByCoupon.get(String(coupon.id)) ?? 0,
    }));
  }
}
