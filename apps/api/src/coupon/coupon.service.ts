import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { COUPON_STATUS } from '../common/constants/payment';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { paginate } from '@baby-mall/shared';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

const DISPLAY_COUPON_STATUS = {
  AVAILABLE: 1,
  USED: 2,
  EXPIRED: 3,
  LOCKED: 4,
} as const;

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findCenterList(page = 1, pageSize = 20) {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        status: 1,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    const available = coupons.filter(
      (coupon) => coupon.totalCount === 0 || coupon.receivedCount < coupon.totalCount,
    );
    const start = (page - 1) * pageSize;
    return paginate(
      available.slice(start, start + pageSize).map((coupon) =>
        this.serializeCoupon(coupon, { received: false }),
      ),
      available.length,
      page,
      pageSize,
    );
  }

  async findAvailable(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const now = new Date();
    const [user, coupons, isNewCustomer] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userIdValue, deletedAt: null },
        select: { id: true, memberLevelId: true },
      }),
      this.prisma.coupon.findMany({
        where: {
          status: 1,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.isNewCustomer(userIdValue),
    ]);
    if (!user) throw new NotFoundException('用户不存在');

    const result: any[] = [];
    for (const coupon of coupons) {
      if (coupon.totalCount > 0 && coupon.receivedCount >= coupon.totalCount) continue;
      if (coupon.memberLevelId && coupon.memberLevelId !== user.memberLevelId) continue;
      if (coupon.isNewUser === 1 && !isNewCustomer) continue;
      const received = await this.prisma.userCoupon.count({
        where: { userId: userIdValue, couponId: coupon.id },
      });
      if (received >= coupon.perLimit) continue;
      result.push(this.serializeCoupon(coupon, { received: received > 0 }));
    }
    return result;
  }

  async findMyCoupons(userId: string, displayStatus?: number, page = 1, pageSize = 20) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    await this.expireUserCoupons(userIdValue);

    const dbStatus = displayStatus === undefined
      ? undefined
      : this.displayStatusToDbStatus(displayStatus);
    const where: Prisma.UserCouponWhereInput = {
      userId: userIdValue,
      ...(dbStatus !== undefined ? { status: dbStatus } : {}),
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
    return paginate(list.map((item) => this.serializeUserCoupon(item)), total, page, pageSize);
  }

  async findUsable(userId: string, amount = 0, productIds: string[] = []) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new BadRequestException('订单金额无效');
    }
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    await this.expireUserCoupons(userIdValue);

    const now = new Date();
    const list = await this.prisma.userCoupon.findMany({
      where: {
        userId: userIdValue,
        status: COUPON_STATUS.FREE,
        OR: [{ expireAt: null }, { expireAt: { gte: now } }],
        coupon: {
          startTime: { lte: now },
          endTime: { gte: now },
          minAmount: { lte: amount },
        },
      },
      include: { coupon: true },
      orderBy: { expireAt: 'asc' },
    });

    const scopes = productIds.length > 0 ? await this.loadProductScopes(productIds) : [];
    return list
      .filter((item) => this.couponScopeMatches(item.coupon, scopes))
      .map((item) => this.serializeUserCoupon(item));
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

      const couponRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM coupons WHERE id = ${couponIdValue} FOR UPDATE
      `;
      if (couponRows.length === 0) throw new NotFoundException('优惠券不存在');

      const coupon = await tx.coupon.findUnique({ where: { id: couponIdValue } });
      if (!coupon) throw new NotFoundException('优惠券不存在');

      const now = new Date();
      if (coupon.status !== 1) throw new BadRequestException('优惠券已停止领取');
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
        const paidOrFulfilledOrders = await tx.order.count({
          where: { userId: userIdValue, status: { notIn: ['pending_payment', 'cancelled'] } },
        });
        if (paidOrFulfilledOrders > 0) throw new BadRequestException('该优惠券仅限新用户领取');
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
          status: COUPON_STATUS.FREE,
          expireAt,
        },
        include: { coupon: true },
      });
      await tx.coupon.update({
        where: { id: couponIdValue },
        data: { receivedCount: { increment: 1 } },
      });
      return userCoupon;
    });

    this.logger.log(`用户${userIdValue}领取优惠券${couponIdValue}`);
    return this.serializeUserCoupon(result);
  }

  async findAllAdmin(dto: CouponQueryDto) {
    const where: Prisma.CouponWhereInput = {};
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
    return paginate(list.map((item) => this.serializeCoupon(item)), total, dto.page, dto.pageSize);
  }

  async findById(id: string) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('优惠券不存在');
    return this.serializeCoupon(coupon);
  }

  async create(dto: CreateCouponDto) {
    const data = this.normalizeCreateInput(dto);
    this.assertCouponFinalState(data);
    const applicableType = Number((data as any).applicableType ?? 0);
    await this.assertApplicableTargetsExist(
      applicableType,
      this.parseApplicableIds((data as any).applicableIds),
    );
    const coupon = await this.prisma.coupon.create({ data });
    this.logger.log(`创建优惠券${coupon.id}`);
    return this.serializeCoupon(coupon);
  }

  async update(id: string, dto: UpdateCouponDto) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;
      const current = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!current) throw new NotFoundException('优惠券不存在');

      const currentMeta = this.parseApplicableMeta(current.applicableIds);
      const nextIds = dto.applicableIds ?? currentMeta.ids;
      const nextDescription = dto.description ?? currentMeta.description;
      const patch: any = {};
      if (dto.name !== undefined) patch.name = dto.name.trim();
      if (dto.type !== undefined) patch.type = dto.type;
      if (dto.value !== undefined) patch.value = dto.value;
      if (dto.minAmount !== undefined || dto.type === 3) {
        patch.minAmount = dto.type === 3 ? 0 : dto.minAmount;
      }
      if (dto.discountLimit !== undefined) patch.discountLimit = dto.discountLimit;
      if (dto.totalCount !== undefined) patch.totalCount = dto.totalCount;
      if (dto.perLimit !== undefined) patch.perLimit = dto.perLimit;
      if (dto.startTime !== undefined) patch.startTime = new Date(dto.startTime);
      if (dto.endTime !== undefined) patch.endTime = new Date(dto.endTime);
      if (dto.validDays !== undefined) patch.validDays = dto.validDays;
      if (dto.applicableType !== undefined) patch.applicableType = dto.applicableType;
      if (dto.memberLevelId !== undefined) {
        patch.memberLevelId = dto.memberLevelId === 0
          ? null
          : parsePositiveBigIntId(dto.memberLevelId, '会员等级');
      }
      if (dto.isNewUser !== undefined) patch.isNewUser = dto.isNewUser;
      if (dto.status !== undefined) patch.status = dto.status;
      if (dto.applicableIds !== undefined || dto.description !== undefined) {
        patch.applicableIds = this.buildApplicableMeta(nextIds, nextDescription);
      }

      const finalState = {
        ...current,
        name: dto.name ?? current.name,
        type: dto.type ?? current.type,
        value: dto.value ?? current.value,
        minAmount: (dto.type ?? current.type) === 3 ? 0 : (dto.minAmount ?? current.minAmount),
        discountLimit: dto.discountLimit ?? current.discountLimit,
        totalCount: dto.totalCount ?? current.totalCount,
        perLimit: dto.perLimit ?? current.perLimit,
        startTime: dto.startTime ? new Date(dto.startTime) : current.startTime,
        endTime: dto.endTime ? new Date(dto.endTime) : current.endTime,
        validDays: dto.validDays ?? current.validDays,
        applicableType: dto.applicableType ?? current.applicableType,
        applicableIds: this.buildApplicableMeta(nextIds, nextDescription),
        memberLevelId: dto.memberLevelId === undefined
          ? current.memberLevelId
          : dto.memberLevelId === 0
            ? null
            : parsePositiveBigIntId(dto.memberLevelId, '会员等级'),
        isNewUser: dto.isNewUser ?? current.isNewUser,
        status: dto.status ?? current.status,
      };

      this.assertCouponFinalState(finalState);
      if (finalState.totalCount > 0 && finalState.totalCount < current.receivedCount) {
        throw new BadRequestException(`发行量不能低于已领取数量${current.receivedCount}`);
      }
      await this.assertApplicableTargetsExist(finalState.applicableType, nextIds, tx);
      if (current.receivedCount > 0) {
        this.assertIssuedCouponEconomicTermsUnchanged(current, finalState);
      }

      return tx.coupon.update({ where: { id: couponId }, data: patch });
    });

    this.logger.log(`更新优惠券${couponId}`);
    return this.serializeCoupon(result);
  }

  async delete(id: string) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;
      const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) throw new NotFoundException('优惠券不存在');
      const issuedCount = await tx.userCoupon.count({ where: { couponId } });
      if (issuedCount > 0) {
        const disabled = await tx.coupon.update({ where: { id: couponId }, data: { status: 0 } });
        return { coupon: disabled, deleted: false };
      }
      await tx.coupon.delete({ where: { id: couponId } });
      return { coupon, deleted: true };
    });
    this.logger.log(`${result.deleted ? '删除' : '停止发放'}优惠券${couponId}`);
    return { ...this.serializeCoupon(result.coupon), deleted: result.deleted };
  }

  parseApplicableIds(raw: unknown): string[] {
    return this.parseApplicableMeta(raw).ids;
  }

  private parseApplicableMeta(raw: unknown): { ids: string[]; description: string } {
    if (raw === null || raw === undefined || raw === '') return { ids: [], description: '' };
    let parsed: any = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new BadRequestException('优惠券适用范围配置损坏');
      }
    }
    const values = Array.isArray(parsed) ? parsed : parsed?.ids;
    const description = !Array.isArray(parsed) && typeof parsed?.description === 'string'
      ? parsed.description.trim()
      : '';
    if (!Array.isArray(values)) throw new BadRequestException('优惠券适用范围配置无效');
    return {
      ids: values.map((item) => parsePositiveBigIntId(item, '优惠券适用范围').toString()),
      description,
    };
  }

  private buildApplicableMeta(ids: string[], description = ''): Prisma.InputJsonValue {
    return {
      ids: Array.from(new Set(ids.map((item) =>
        parsePositiveBigIntId(item, '优惠券适用范围').toString(),
      ))),
      description: String(description || '').trim(),
    };
  }

  private normalizeCreateInput(dto: CreateCouponDto): Prisma.CouponCreateInput {
    const ids = dto.applicableIds ?? [];
    const data: any = {
      name: dto.name.trim(),
      type: dto.type,
      value: dto.value,
      minAmount: dto.type === 3 ? 0 : (dto.minAmount ?? 0),
      discountLimit: dto.discountLimit ?? 0,
      totalCount: dto.totalCount ?? 0,
      receivedCount: 0,
      usedCount: 0,
      perLimit: dto.perLimit ?? 1,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      validDays: dto.validDays ?? 0,
      applicableType: dto.applicableType ?? 0,
      applicableIds: this.buildApplicableMeta(ids, dto.description ?? ''),
      memberLevelId: dto.memberLevelId && dto.memberLevelId > 0
        ? parsePositiveBigIntId(dto.memberLevelId, '会员等级')
        : null,
      isNewUser: dto.isNewUser ?? 0,
      status: dto.status ?? 1,
    };
    return data as Prisma.CouponCreateInput;
  }

  private assertCouponFinalState(coupon: any) {
    const name = String(coupon.name || '').trim();
    if (!name) throw new BadRequestException('优惠券名称不能为空');
    if (name.length > 50) throw new BadRequestException('优惠券名称不能超过50个字符');

    const start = new Date(coupon.startTime);
    const end = new Date(coupon.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('优惠券结束时间必须晚于开始时间');
    }
    if (![1, 2, 3].includes(Number(coupon.type))) throw new BadRequestException('优惠券类型无效');
    if (!Number.isSafeInteger(Number(coupon.value)) || Number(coupon.value) <= 0) {
      throw new BadRequestException('优惠券优惠值必须为正整数');
    }
    if (Number(coupon.type) === 2 && Number(coupon.value) > 100) {
      throw new BadRequestException('折扣券折扣值必须在1-100之间');
    }
    if (Number(coupon.type) === 3 && Number(coupon.minAmount) !== 0) {
      throw new BadRequestException('无门槛券的使用门槛必须为0');
    }
    if (!Number.isSafeInteger(Number(coupon.totalCount)) || Number(coupon.totalCount) < 0) {
      throw new BadRequestException('优惠券发行数量无效');
    }
    if (!Number.isSafeInteger(Number(coupon.perLimit)) || Number(coupon.perLimit) <= 0) {
      throw new BadRequestException('优惠券每人限领数量无效');
    }
    if (![0, 1, 2].includes(Number(coupon.applicableType))) {
      throw new BadRequestException('优惠券适用范围类型无效');
    }
    const ids = this.parseApplicableIds(coupon.applicableIds);
    if ([1, 2].includes(Number(coupon.applicableType)) && ids.length === 0) {
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

  private async assertApplicableTargetsExist(applicableType: number, ids: string[], client: any = this.prisma) {
    if (applicableType === 0) return;
    const bigintIds = ids.map((id) => parsePositiveBigIntId(id, '优惠券适用范围'));
    if (applicableType === 1) {
      const count = await client.productCategory.count({
        where: { id: { in: bigintIds }, deletedAt: null },
      });
      if (count !== bigintIds.length) throw new BadRequestException('优惠券包含不存在的商品分类');
      return;
    }
    if (applicableType === 2) {
      const count = await client.product.count({ where: { id: { in: bigintIds }, deletedAt: null } });
      if (count !== bigintIds.length) throw new BadRequestException('优惠券包含不存在的商品');
      return;
    }
    throw new BadRequestException('优惠券适用范围类型无效');
  }

  private async loadProductScopes(productIds: string[]) {
    const ids = Array.from(new Set(productIds.map((id) =>
      parsePositiveBigIntId(id, '商品').toString(),
    ))).map((id) => BigInt(id));
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 1 },
      select: { id: true, categoryId: true },
    });
    if (rows.length !== ids.length) throw new BadRequestException('订单包含不存在或已下架的商品');
    return rows;
  }

  private couponScopeMatches(coupon: any, scopes: Array<{ id: bigint; categoryId: bigint }>) {
    if (!coupon || coupon.applicableType === 0) return true;
    if (scopes.length === 0) return false;
    const ids = new Set(this.parseApplicableIds(coupon.applicableIds));
    if (coupon.applicableType === 1) {
      return scopes.every((product) => ids.has(product.categoryId.toString()));
    }
    if (coupon.applicableType === 2) {
      return scopes.every((product) => ids.has(product.id.toString()));
    }
    return false;
  }

  private async expireUserCoupons(userId: bigint) {
    const now = new Date();
    await this.prisma.userCoupon.updateMany({
      where: { userId, status: COUPON_STATUS.FREE, expireAt: { lt: now } },
      data: { status: COUPON_STATUS.EXPIRED },
    });

    const legacyExpired = await this.prisma.userCoupon.findMany({
      where: {
        userId,
        status: COUPON_STATUS.FREE,
        expireAt: null,
        coupon: { endTime: { lt: now } },
      },
      select: { id: true },
    });
    if (legacyExpired.length > 0) {
      await this.prisma.userCoupon.updateMany({
        where: { id: { in: legacyExpired.map((item) => item.id) }, status: COUPON_STATUS.FREE },
        data: { status: COUPON_STATUS.EXPIRED },
      });
    }
  }

  private displayStatusToDbStatus(status: number): number {
    if (status === DISPLAY_COUPON_STATUS.AVAILABLE) return COUPON_STATUS.FREE;
    if (status === DISPLAY_COUPON_STATUS.USED) return COUPON_STATUS.USED;
    if (status === DISPLAY_COUPON_STATUS.EXPIRED) return COUPON_STATUS.EXPIRED;
    if (status === DISPLAY_COUPON_STATUS.LOCKED) return COUPON_STATUS.LOCKED;
    throw new BadRequestException('优惠券状态筛选无效');
  }

  private dbStatusToDisplayStatus(status: number): number {
    if (status === COUPON_STATUS.FREE) return DISPLAY_COUPON_STATUS.AVAILABLE;
    if (status === COUPON_STATUS.USED) return DISPLAY_COUPON_STATUS.USED;
    if (status === COUPON_STATUS.EXPIRED) return DISPLAY_COUPON_STATUS.EXPIRED;
    if (status === COUPON_STATUS.LOCKED) return DISPLAY_COUPON_STATUS.LOCKED;
    return status;
  }

  private async isNewCustomer(userId: bigint) {
    const count = await this.prisma.order.count({
      where: { userId, status: { notIn: ['pending_payment', 'cancelled'] } },
    });
    return count === 0;
  }

  private serializeCoupon(coupon: any, options?: { received?: boolean }) {
    const meta = this.parseApplicableMeta(coupon.applicableIds);
    const remainCount = coupon.totalCount === 0
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, coupon.totalCount - coupon.receivedCount);
    return {
      ...coupon,
      id: coupon.id.toString(),
      memberLevelId: coupon.memberLevelId?.toString() ?? null,
      applicableIds: meta.ids,
      description: meta.description,
      maxDiscount: coupon.discountLimit ?? 0,
      remainCount,
      received: options?.received ?? false,
    };
  }

  private serializeUserCoupon(item: any) {
    const coupon = this.serializeCoupon(item.coupon);
    return {
      id: item.id.toString(),
      userId: item.userId.toString(),
      couponId: item.couponId.toString(),
      status: this.dbStatusToDisplayStatus(item.status),
      rawStatus: item.status,
      expireAt: item.expireAt,
      usedAt: item.usedAt,
      useTime: item.usedAt,
      usedOrderId: item.usedOrderId?.toString() ?? null,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      minAmount: coupon.minAmount,
      discountLimit: coupon.discountLimit,
      startTime: coupon.startTime,
      endTime: item.expireAt ?? coupon.endTime,
      applicableType: coupon.applicableType,
      applicableIds: coupon.applicableIds,
      description: coupon.description,
      coupon,
    };
  }
}
