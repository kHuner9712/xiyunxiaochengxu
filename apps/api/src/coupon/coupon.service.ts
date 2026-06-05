import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { paginate } from '@baby-mall/shared';
import { COUPON_STATUS } from '../common/constants/payment';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private prisma: PrismaService) {}

  async findCenterList(page: number = 1, pageSize: number = 10) {
    const now = new Date();
    const where: any = {
      status: 1,
      startTime: { lte: now },
      endTime: { gte: now },
    };

    const [list, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return paginate(list.map((c) => this.serializeCoupon(c)), total, page, pageSize);
  }

  async findAvailable(_userId: string) {
    const now = new Date();
    const where: any = {
      status: 1,
      startTime: { lte: now },
      endTime: { gte: now },
    };

    const coupons = await this.prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return coupons.map((c) => this.serializeCoupon(c));
  }

  async findMyCoupons(userId: string, status?: number, page: number = 1, pageSize: number = 10) {
    const now = new Date();
    const where: any = { userId: BigInt(userId) };
    if (status === 1) {
      where.status = COUPON_STATUS.FREE;
      where.OR = [{ expireAt: null }, { expireAt: { gte: now } }];
    } else if (status === 2) {
      where.status = COUPON_STATUS.USED;
    } else if (status === 3) {
      where.OR = [
        { status: COUPON_STATUS.EXPIRED },
        { status: COUPON_STATUS.FREE, expireAt: { lt: now } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.userCoupon.findMany({
        where,
        include: { coupon: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userCoupon.count({ where }),
    ]);

    return paginate(list.map((uc) => this.serializeUserCoupon(uc)), total, page, pageSize);
  }

  async findUsable(userId: string, amount: number) {
    const now = new Date();
    const where: any = {
      userId: BigInt(userId),
      status: COUPON_STATUS.FREE,
      expireAt: { gte: now },
    };

    if (amount > 0) {
      where.coupon = { minAmount: { lte: amount } };
    }

    const list = await this.prisma.userCoupon.findMany({
      where,
      include: { coupon: true },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((uc) => this.serializeUserCoupon(uc));
  }

  async receive(userId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: BigInt(couponId), status: 1 },
    });
    if (!coupon) throw new NotFoundException('优惠券不存在');

    const now = new Date();
    if (now < coupon.startTime || now > coupon.endTime) {
      throw new BadRequestException('优惠券不在领取时间范围内');
    }

    if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) {
      throw new BadRequestException('优惠券已领完');
    }

    const userReceived = await this.prisma.userCoupon.count({
      where: { userId: BigInt(userId), couponId: BigInt(couponId) },
    });
    if (coupon.perLimit > 0 && userReceived >= coupon.perLimit) {
      throw new BadRequestException('已达到领取上限');
    }

    if (coupon.isNewUser === 1) {
      const orderCount = await this.prisma.order.count({
        where: { userId: BigInt(userId), status: { not: 'cancelled' } },
      });
      if (orderCount > 0) {
        throw new BadRequestException('仅限新用户领取');
      }
    }

    if (coupon.memberLevelId) {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(userId) },
      });
      if (!user || user.memberLevelId !== coupon.memberLevelId) {
        throw new BadRequestException('会员等级不满足领取条件');
      }
    }

    let expireAt: Date;
    if (coupon.validDays && coupon.validDays > 0) {
      expireAt = new Date(Date.now() + coupon.validDays * 24 * 60 * 60 * 1000);
    } else {
      expireAt = coupon.endTime;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (coupon.totalCount > 0) {
        const updated = await tx.coupon.updateMany({
          where: { id: BigInt(couponId), receivedCount: { lt: coupon.totalCount } },
          data: { receivedCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new BadRequestException('优惠券已领完');
        }
      } else {
        await tx.coupon.update({
          where: { id: BigInt(couponId) },
          data: { receivedCount: { increment: 1 } },
        });
      }

      return tx.userCoupon.create({
        data: {
          userId: BigInt(userId),
          couponId: BigInt(couponId),
          expireAt,
        },
      });
    });

    this.logger.log(`用户${userId}领取优惠券${couponId}`);
    return this.serializeUserCoupon(result);
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: BigInt(id) },
    });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    return this.serializeCoupon(coupon);
  }

  async findAllAdmin(dto: CouponQueryDto) {
    const where: any = {};
    if (dto.type !== undefined) where.type = dto.type;
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.name) where.name = { contains: dto.name };

    const [list, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return paginate(list.map((c) => this.serializeCoupon(c)), total, dto.page, dto.pageSize);
  }

  async create(data: any) {
    const coupon = await this.prisma.coupon.create({ data });
    this.logger.log(`创建优惠券：${coupon.id}`);
    return this.serializeCoupon(coupon);
  }

  async update(id: string, data: any) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id: BigInt(id) } });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    const result = await this.prisma.coupon.update({ where: { id: BigInt(id) }, data });
    this.logger.log(`更新优惠券：${id}`);
    return this.serializeCoupon(result);
  }

  async delete(id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id: BigInt(id) } });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    const result = await this.prisma.coupon.update({
      where: { id: BigInt(id) },
      data: { status: 2 },
    });
    this.logger.log(`删除优惠券：${id}`);
    return this.serializeCoupon(result);
  }

  private serializeCoupon(coupon: any) {
    return {
      ...coupon,
      id: coupon.id.toString(),
      memberLevelId: coupon.memberLevelId?.toString(),
    };
  }

  private serializeUserCoupon(uc: any) {
    const coupon = uc.coupon ? this.serializeCoupon(uc.coupon) : null;
    const isExpired = uc.status === COUPON_STATUS.EXPIRED || (uc.status === COUPON_STATUS.FREE && uc.expireAt && new Date() > uc.expireAt);
    const displayStatus = isExpired
      ? 3
      : uc.status === COUPON_STATUS.USED
        ? 2
        : 1;

    return {
      ...uc,
      id: uc.id.toString(),
      userId: uc.userId.toString(),
      couponId: uc.couponId.toString(),
      usedOrderId: uc.usedOrderId?.toString(),
      status: displayStatus,
      name: coupon?.name || '',
      type: coupon?.type || 1,
      value: coupon?.value || 0,
      minAmount: coupon?.minAmount || 0,
      startTime: coupon?.startTime,
      endTime: uc.expireAt || coupon?.endTime,
      useTime: uc.usedAt,
      orderNo: undefined,
      coupon,
    };
  }
}
