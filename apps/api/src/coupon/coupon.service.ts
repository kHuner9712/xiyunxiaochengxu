import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { paginate } from '@baby-mall/shared';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

const USER_COUPON_FREE = 1;
const USER_COUPON_USED = 2;
const USER_COUPON_EXPIRED = 3;

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async findCenterList(page = 1, pageSize = 20) {
    const now = new Date();
    const where: Prisma.CouponWhereInput = {
      status: 1,
      startTime: { lte: now },
      endTime: { gte: now },
      OR: [
        { totalCount: 0 },
        { receivedCount: { lt: this.prisma.coupon.fields.totalCount } as any },
      ],
    };

    // Prisma cannot compare two columns through the typed filter above on all supported clients.
    // Use the same durable condition in SQL for the public center and keep the result bounded.
    const offset = Math.max(0, (page - 1) * pageSize);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM coupons
      WHERE status = 1
        AND start_time <= ${now}
        AND end_time >= ${now}
        AND (total_count = 0 OR received_count < total_count)
        AND deleted_at IS NULL
      ORDER BY sort_order ASC, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const totalRows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
      FROM coupons
      WHERE status = 1
        AND start_time <= ${now}
        AND end_time >= ${now}
        AND (total_count = 0 OR received_count < total_count)
        AND deleted_at IS NULL
    `;
    return paginate(
      rows.map((row) => this.serializeCoupon(row)),
      Number(totalRows[0]?.total ?? 0n),
      page,
      pageSize,
    );
  }

  async findAvailable(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const now = new Date();
    const [user, coupons] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userIdValue, deletedAt: null },
        select: { id: true, memberLevelId: true },
      }),
      this.prisma.coupon.findMany({
        where: {
          status: 1,
          deletedAt: null,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      }),
    ]);
    if (!user) throw new NotFoundException('用户不存在');

    const result = [] as any[];
    for (const coupon of coupons) {
      if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) continue;
      if (coupon.memberLevelId && coupon.memberLevelId !== user.memberLevelId) continue;
      if (coupon.isNewUser === 1 && !(await this.isNewCustomer(userIdValue))) continue;
      const received = await this.prisma.userCoupon.count({
        where: { userId: userIdValue, couponId: coupon.id },
      });
      if (received >= coupon.perLimit) continue;
      result.push(this.serializeCoupon(coupon));
    }
    return result;
  }

  async findMyCoupons(userId: string, status?: number, page = 1, pageSize = 20) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const now = new Date();
    await this.prisma.userCoupon.updateMany({
      where: {
        userId: userIdValue,
        status: USER_COUPON_FREE,
        expireAt: { lt: now },
      },
      data: { status: USER_COUPON_EXPIRED },
    });

    const where: Prisma.UserCouponWhereInput = {
      userId: userIdValue,
      ...(status !== undefined ? { status } : {}),
    };
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
    return paginate(
      list.map((item) => this.serializeUserCoupon(item)),
      total,
      page,
      pageSize,
    );
  }

  async findUsable(userId: string, amount = 0) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new BadRequestException('订单金额无效');
    }
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const now = new Date();
    await this.prisma.userCoupon.updateMany({
      where: { userId: userIdValue, status: USER_COUPON_FREE, expireAt: { lt: now } },
      data: { status: USER_COUPON_EXPIRED },
    });
    const list = await this.prisma.userCoupon.findMany({
      where: {
        userId: userIdValue,
        status: USER_COUPON_FREE,
        expireAt: { gte: now },
        coupon: { minAmount: { lte: amount } },
      },
      include: { coupon: true },
      orderBy: { expireAt: 'asc' },
    });
    return list.map((item) => this.serializeUserCoupon(item));
  }

  async receive(userId: string, couponId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const couponIdValue = parsePositiveBigIntId(couponId, '优惠券');

    const result = await this.prisma.$transaction(async (tx) => {
      const userRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM users
        WHERE id = ${userIdValue} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (userRows.length === 0) throw new NotFoundException('用户不存在');

      await tx.$queryRaw`
        SELECT id FROM coupons
        WHERE id = ${couponIdValue}
        FOR UPDATE
      `;
      const coupon = await tx.coupon.findFirst({
        where: { id: couponIdValue, deletedAt: null },
      });
      if (!coupon) throw new NotFoundException('优惠券不存在');

      const now = new Date();
      if (coupon.status !== 1) throw new BadRequestException('优惠券已停用');
      if (now < coupon.startTime) throw new BadRequestException('优惠券尚未开始领取');
      if (now > coupon.endTime) throw new BadRequestException('优惠券已结束');
      if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) {
        throw new BadRequestException('优惠券已领完');
      }

      const user = await tx.user.findUnique({
        where: { id: userIdValue },
        select: { memberLevelId: true },
      });
      if (!user) throw new NotFoundException('用户不存在');
      if (coupon.memberLevelId && coupon.memberLevelId !== user.memberLevelId) {
        throw new BadRequestException('当前会员等级不满足领取条件');
      }
      if (coupon.isNewUser === 1) {
        const nonNewOrders = await tx.order.count({
          where: {
            userId: userIdValue,
            status: { notIn: ['pending_payment', 'cancelled'] },
          },
        });
        if (nonNewOrders > 0) throw new BadRequestException('该优惠券仅限新用户领取');
      }

      const receivedCount = await tx.userCoupon.count({
        where: { userId: userIdValue, couponId: couponIdValue },
      });
      if (receivedCount >= coupon.perLimit) {
        throw new BadRequestException(`每人最多领取${coupon.perLimit}张`);
      }

      const expireAtByDays = coupon.validDays > 0
        ? new Date(now.getTime() + coupon.validDays * 24 * 60 * 60 * 1000)
        : coupon.endTime;
      const expireAt = expireAtByDays < coupon.endTime ? expireAtByDays : coupon.endTime;

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId: userIdValue,
          couponId: couponIdValue,
          status: USER_COUPON_FREE,
          expireAt,
        },
      });
      await tx.coupon.update({
        where: { id: couponIdValue },
        data: { receivedCount: { increment: 1 } },
      });
      return userCoupon;
    });

    return {
      ...result,
      id: result.id.toString(),
      userId: result.userId.toString(),
      couponId: result.couponId.toString(),
    };
  }

  async findAllAdmin(dto: CouponQueryDto) {
    const where: Prisma.CouponWhereInput = { deletedAt: null };
    if (dto.type !== undefined) where.type = dto.type;
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.name) where.name = { contains: dto.name };

    const [list, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return paginate(list.map((item) => this.serializeCoupon(item)), total, dto.page, dto.pageSize);
  }

  async findById(id: string) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, deletedAt: null },
    });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    return this.serializeCoupon(coupon);
  }

  async create(dto: CreateCouponDto) {
    const normalized = this.normalizeCouponInput(dto);
    this.assertCouponFinalState(normalized);
    const coupon = await this.prisma.coupon.create({ data: normalized });
    return this.serializeCoupon(coupon);
  }

  async update(id: string, dto: UpdateCouponDto) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;
      const current = await tx.coupon.findFirst({
        where: { id: couponId, deletedAt: null },
      });
      if (!current) throw new NotFoundException('优惠券不存在');

      const patch = this.normalizeCouponInput(dto, true);
      const finalState = {
        ...current,
        ...patch,
        applicableIds: patch.applicableIds !== undefined
          ? patch.applicableIds
          : current.applicableIds,
      };
      this.assertCouponFinalState(finalState);

      if (current.receivedCount > 0) {
        this.assertIssuedCouponEconomicTermsUnchanged(current, finalState);
      }
      const updated = await tx.coupon.update({
        where: { id: couponId },
        data: patch,
      });
      return this.serializeCoupon(updated);
    });
  }

  async delete(id: string) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: couponId, deletedAt: null },
    });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    const updated = await this.prisma.coupon.update({
      where: { id: couponId },
      data: { status: 2, deletedAt: new Date() },
    });
    return this.serializeCoupon(updated);
  }

  parseApplicableIds(raw: unknown): string[] {
    if (raw === null || raw === undefined || raw === '') return [];
    let parsed = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new BadRequestException('优惠券适用范围配置损坏');
      }
    }
    if (!Array.isArray(parsed)) throw new BadRequestException('优惠券适用范围配置无效');
    return parsed.map((item) => parsePositiveBigIntId(item, '优惠券适用范围').toString());
  }

  private async isNewCustomer(userId: bigint) {
    const count = await this.prisma.order.count({
      where: { userId, status: { notIn: ['pending_payment', 'cancelled'] } },
    });
    return count === 0;
  }

  private normalizeCouponInput(dto: CreateCouponDto | UpdateCouponDto, partial = false): any {
    const source = dto as any;
    const data: any = {};
    const copy = (key: string) => {
      if (!partial || source[key] !== undefined) data[key] = source[key];
    };
    for (const key of [
      'name', 'type', 'value', 'minAmount', 'totalCount', 'perLimit',
      'validDays', 'applicableType', 'isNewUser',
    ]) copy(key);

    if (!partial || source.startTime !== undefined) {
      data.startTime = source.startTime ? new Date(source.startTime) : undefined;
    }
    if (!partial || source.endTime !== undefined) {
      data.endTime = source.endTime ? new Date(source.endTime) : undefined;
    }
    if (!partial || source.discountLimit !== undefined || source.maxDiscount !== undefined) {
      data.discountLimit = source.discountLimit ?? source.maxDiscount ?? null;
    }
    if (!partial || source.memberLevelId !== undefined || source.memberLevel !== undefined) {
      const member = source.memberLevelId ?? source.memberLevel;
      data.memberLevelId = member === undefined || member === null || Number(member) === 0
        ? null
        : parsePositiveBigIntId(member, '会员等级');
    }
    if (!partial || source.applicableIds !== undefined) {
      data.applicableIds = (source.applicableIds ?? []).map((item: unknown) =>
        parsePositiveBigIntId(item, '优惠券适用范围').toString(),
      );
    }

    if (!partial) {
      data.minAmount ??= 0;
      data.discountLimit ??= 0;
      data.totalCount ??= 0;
      data.perLimit ??= 1;
      data.validDays ??= 0;
      data.applicableType ??= 0;
      data.applicableIds ??= [];
      data.isNewUser ??= 0;
      data.status = 1;
      data.sortOrder = 0;
    }
    return data;
  }

  private assertCouponFinalState(coupon: any) {
    if (!coupon.name || String(coupon.name).trim().length === 0) {
      throw new BadRequestException('优惠券名称不能为空');
    }
    if (String(coupon.name).trim().length > 50) {
      throw new BadRequestException('优惠券名称不能超过50个字符');
    }
    const start = new Date(coupon.startTime);
    const end = new Date(coupon.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('优惠券结束时间必须晚于开始时间');
    }
    if (![1, 2, 3, 4].includes(Number(coupon.type))) {
      throw new BadRequestException('优惠券类型无效');
    }
    if (!Number.isSafeInteger(Number(coupon.value)) || Number(coupon.value) <= 0) {
      throw new BadRequestException('优惠券面值必须为正整数');
    }
    if (Number(coupon.type) === 2 && Number(coupon.value) > 100) {
      throw new BadRequestException('折扣券折扣值必须在1-100之间');
    }
    if (![0, 1, 2].includes(Number(coupon.applicableType))) {
      throw new BadRequestException('优惠券适用范围类型无效');
    }
    const ids = this.parseApplicableIds(coupon.applicableIds);
    if ((Number(coupon.applicableType) === 1 || Number(coupon.applicableType) === 2) && ids.length === 0) {
      throw new BadRequestException('指定分类或商品优惠券必须配置适用范围');
    }
    if (Number(coupon.applicableType) === 0 && ids.length > 0) {
      throw new BadRequestException('全场优惠券不应配置指定商品或分类');
    }
  }

  private assertIssuedCouponEconomicTermsUnchanged(current: any, next: any) {
    const currentIds = this.parseApplicableIds(current.applicableIds).sort().join(',');
    const nextIds = this.parseApplicableIds(next.applicableIds).sort().join(',');
    const changed =
      current.type !== next.type ||
      current.value !== next.value ||
      current.minAmount !== next.minAmount ||
      current.discountLimit !== next.discountLimit ||
      current.applicableType !== next.applicableType ||
      currentIds !== nextIds ||
      current.startTime.getTime() !== new Date(next.startTime).getTime() ||
      current.endTime.getTime() !== new Date(next.endTime).getTime() ||
      current.validDays !== next.validDays;
    if (changed) {
      throw new BadRequestException(
        '该优惠券已有用户领取，面值、门槛、有效期和适用范围不能直接修改；请新建优惠券并停止旧券继续发放',
      );
    }
  }

  private serializeCoupon(coupon: any) {
    return {
      ...coupon,
      id: coupon.id.toString(),
      memberLevelId: coupon.memberLevelId?.toString() ?? null,
      applicableIds: this.parseApplicableIds(coupon.applicableIds),
      maxDiscount: coupon.discountLimit ?? 0,
    };
  }

  private serializeUserCoupon(item: any) {
    return {
      ...item,
      id: item.id.toString(),
      userId: item.userId.toString(),
      couponId: item.couponId.toString(),
      coupon: this.serializeCoupon(item.coupon),
    };
  }
}
