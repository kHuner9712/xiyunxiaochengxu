import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const list = await this.prisma.userAddress.findMany({
      where: { userId: BigInt(userId), deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return list.map((a) => this.serializeAddress(a));
  }

  async findById(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');
    return this.serializeAddress(address);
  }

  async create(userId: string, data: {
    receiverName?: string;
    receiverPhone?: string;
    name?: string;
    phone?: string;
    province: string;
    city: string;
    district: string;
    detailAddress?: string;
    detail?: string;
    isDefault?: number | boolean;
  }) {
    const count = await this.prisma.userAddress.count({
      where: { userId: BigInt(userId), deletedAt: null },
    });
    if (count >= 20) throw new BadRequestException('最多保留20条地址');

    const dbData = {
      receiverName: data.receiverName || data.name || '',
      receiverPhone: data.receiverPhone || data.phone || '',
      province: data.province,
      city: data.city,
      district: data.district,
      detailAddress: data.detailAddress || data.detail || '',
      isDefault: data.isDefault === true || data.isDefault === 1 ? 1 : 0,
    };

    if (dbData.isDefault === 1) {
      await this.prisma.userAddress.updateMany({
        where: { userId: BigInt(userId), deletedAt: null },
        data: { isDefault: 0 },
      });
    }

    const address = await this.prisma.userAddress.create({
      data: { userId: BigInt(userId), ...dbData },
    });
    this.logger.log(`用户${userId}创建地址`);
    return this.serializeAddress(address);
  }

  async update(userId: string, id: string, data: any) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');

    const dbData: any = {};
    if (data.receiverName !== undefined) dbData.receiverName = data.receiverName;
    else if (data.name !== undefined) dbData.receiverName = data.name;
    if (data.receiverPhone !== undefined) dbData.receiverPhone = data.receiverPhone;
    else if (data.phone !== undefined) dbData.receiverPhone = data.phone;
    if (data.detailAddress !== undefined) dbData.detailAddress = data.detailAddress;
    else if (data.detail !== undefined) dbData.detailAddress = data.detail;
    if (data.province !== undefined) dbData.province = data.province;
    if (data.city !== undefined) dbData.city = data.city;
    if (data.district !== undefined) dbData.district = data.district;
    if (data.isDefault !== undefined) {
      dbData.isDefault = data.isDefault === true || data.isDefault === 1 ? 1 : 0;
    }

    if (dbData.isDefault === 1) {
      await this.prisma.userAddress.updateMany({
        where: { userId: BigInt(userId), deletedAt: null },
        data: { isDefault: 0 },
      });
    }

    const result = await this.prisma.userAddress.update({
      where: { id: BigInt(id) },
      data: dbData,
    });
    this.logger.log(`用户${userId}更新地址${id}`);
    return this.serializeAddress(result);
  }

  async delete(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');

    const result = await this.prisma.userAddress.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`用户${userId}删除地址${id}`);
    return this.serializeAddress(result);
  }

  async setDefault(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');

    await this.prisma.userAddress.updateMany({
      where: { userId: BigInt(userId), deletedAt: null },
      data: { isDefault: 0 },
    });

    const result = await this.prisma.userAddress.update({
      where: { id: BigInt(id) },
      data: { isDefault: 1 },
    });
    this.logger.log(`用户${userId}设置默认地址${id}`);
    return this.serializeAddress(result);
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
