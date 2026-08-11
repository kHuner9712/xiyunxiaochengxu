import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';

type AddressInput = {
  receiverName?: string;
  receiverPhone?: string;
  name?: string;
  phone?: string;
  province?: string;
  city?: string;
  district?: string;
  detailAddress?: string;
  detail?: string;
  isDefault?: number | boolean;
};

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const list = await this.prisma.userAddress.findMany({
      where: { userId: userIdValue, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return list.map((a) => this.serializeAddress(a));
  }

  async findById(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const addressId = parsePositiveBigIntId(id, '地址');
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId: userIdValue, deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');
    return this.serializeAddress(address);
  }

  async create(userId: string, data: AddressInput) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const count = await tx.userAddress.count({
        where: { userId: userIdValue, deletedAt: null },
      });
      if (count >= 20) throw new BadRequestException('最多保留20条地址');

      const dbData = this.normalizeAddressInput(data);
      this.assertCompleteAddress(dbData);
      if (count === 0) dbData.isDefault = 1;

      if (dbData.isDefault === 1) {
        await tx.userAddress.updateMany({
          where: { userId: userIdValue, deletedAt: null },
          data: { isDefault: 0 },
        });
      }

      return tx.userAddress.create({
        data: {
          userId: userIdValue,
          receiverName: dbData.receiverName!,
          receiverPhone: dbData.receiverPhone!,
          province: dbData.province!,
          city: dbData.city!,
          district: dbData.district!,
          detailAddress: dbData.detailAddress!,
          isDefault: dbData.isDefault ?? 0,
        },
      });
    });
    this.logger.log(`用户${userId}创建地址`);
    return this.serializeAddress(result);
  }

  async update(userId: string, id: string, data: AddressInput) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const addressId = parsePositiveBigIntId(id, '地址');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const address = await tx.userAddress.findFirst({
        where: { id: addressId, userId: userIdValue, deletedAt: null },
      });
      if (!address) throw new NotFoundException('地址不存在');

      const patch = this.normalizeAddressInput(data, true);
      const merged = {
        receiverName: patch.receiverName ?? address.receiverName,
        receiverPhone: patch.receiverPhone ?? address.receiverPhone,
        province: patch.province ?? address.province,
        city: patch.city ?? address.city,
        district: patch.district ?? address.district,
        detailAddress: patch.detailAddress ?? address.detailAddress,
        isDefault: patch.isDefault ?? address.isDefault,
      };
      this.assertCompleteAddress(merged);

      if (merged.isDefault === 1) {
        await tx.userAddress.updateMany({
          where: { userId: userIdValue, deletedAt: null, id: { not: addressId } },
          data: { isDefault: 0 },
        });
      }

      const updated = await tx.userAddress.update({
        where: { id: addressId },
        data: merged,
      });

      if (merged.isDefault === 0 && address.isDefault === 1) {
        await this.ensureOneDefaultAddress(tx, userIdValue, addressId);
      }
      return updated;
    });
    this.logger.log(`用户${userId}更新地址${id}`);
    return this.serializeAddress(result);
  }

  async delete(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const addressId = parsePositiveBigIntId(id, '地址');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const address = await tx.userAddress.findFirst({
        where: { id: addressId, userId: userIdValue, deletedAt: null },
      });
      if (!address) throw new NotFoundException('地址不存在');

      const deleted = await tx.userAddress.update({
        where: { id: addressId },
        data: { deletedAt: new Date(), isDefault: 0 },
      });
      if (address.isDefault === 1) {
        await this.ensureOneDefaultAddress(tx, userIdValue, addressId);
      }
      return deleted;
    });
    this.logger.log(`用户${userId}删除地址${id}`);
    return this.serializeAddress(result);
  }

  async setDefault(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const addressId = parsePositiveBigIntId(id, '地址');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const address = await tx.userAddress.findFirst({
        where: { id: addressId, userId: userIdValue, deletedAt: null },
      });
      if (!address) throw new NotFoundException('地址不存在');

      await tx.userAddress.updateMany({
        where: { userId: userIdValue, deletedAt: null, id: { not: addressId } },
        data: { isDefault: 0 },
      });
      return tx.userAddress.update({
        where: { id: addressId },
        data: { isDefault: 1 },
      });
    });
    this.logger.log(`用户${userId}设置默认地址${id}`);
    return this.serializeAddress(result);
  }

  private normalizeAddressInput(data: AddressInput, partial = false) {
    const normalize = (value: unknown) =>
      typeof value === 'string' ? value.trim() : value;
    const result: {
      receiverName?: string;
      receiverPhone?: string;
      province?: string;
      city?: string;
      district?: string;
      detailAddress?: string;
      isDefault?: number;
    } = {};

    const receiverName = data.receiverName !== undefined ? data.receiverName : data.name;
    const receiverPhone = data.receiverPhone !== undefined ? data.receiverPhone : data.phone;
    const detailAddress = data.detailAddress !== undefined ? data.detailAddress : data.detail;
    if (!partial || receiverName !== undefined) result.receiverName = String(normalize(receiverName) ?? '');
    if (!partial || receiverPhone !== undefined) result.receiverPhone = String(normalize(receiverPhone) ?? '');
    if (!partial || data.province !== undefined) result.province = String(normalize(data.province) ?? '');
    if (!partial || data.city !== undefined) result.city = String(normalize(data.city) ?? '');
    if (!partial || data.district !== undefined) result.district = String(normalize(data.district) ?? '');
    if (!partial || detailAddress !== undefined) result.detailAddress = String(normalize(detailAddress) ?? '');
    if (data.isDefault !== undefined) {
      result.isDefault = data.isDefault === true || data.isDefault === 1 ? 1 : 0;
    } else if (!partial) {
      result.isDefault = 0;
    }
    return result;
  }

  private assertCompleteAddress(data: {
    receiverName?: string;
    receiverPhone?: string;
    province?: string;
    city?: string;
    district?: string;
    detailAddress?: string;
  }) {
    if (!data.receiverName) throw new BadRequestException('收货人姓名不能为空');
    if (data.receiverName.length > 50) throw new BadRequestException('收货人姓名不能超过50个字符');
    if (!data.receiverPhone || !/^[0-9+()\-\s]{6,20}$/.test(data.receiverPhone)) {
      throw new BadRequestException('收货人联系电话格式无效');
    }
    if (!data.province || data.province.length > 20) throw new BadRequestException('省份信息无效');
    if (!data.city || data.city.length > 20) throw new BadRequestException('城市信息无效');
    if (!data.district || data.district.length > 20) throw new BadRequestException('区县信息无效');
    if (!data.detailAddress || data.detailAddress.length > 200) {
      throw new BadRequestException('详细地址不能为空且不能超过200个字符');
    }
  }

  private async ensureOneDefaultAddress(
    tx: Prisma.TransactionClient,
    userId: bigint,
    excludeId?: bigint,
  ) {
    const currentDefault = await tx.userAddress.findFirst({
      where: {
        userId,
        deletedAt: null,
        isDefault: 1,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (currentDefault) return;

    const fallback = await tx.userAddress.findFirst({
      where: {
        userId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (fallback) {
      await tx.userAddress.update({
        where: { id: fallback.id },
        data: { isDefault: 1 },
      });
    }
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: bigint) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException('用户不存在');
  }

  private serializeAddress(address: any) {
    return {
      id: address.id.toString(),
      userId: address.userId.toString(),
      name: address.receiverName,
      phone: address.receiverPhone,
      province: address.province,
      city: address.city,
      district: address.district,
      detail: address.detailAddress,
      isDefault: address.isDefault === 1,
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      detailAddress: address.detailAddress,
      fullAddress: `${address.province}${address.city}${address.district}${address.detailAddress}`,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}