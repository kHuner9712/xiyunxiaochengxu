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
    return list.map((a) => ({ ...a, id: a.id.toString(), userId: a.userId.toString() }));
  }

  async findById(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');
    return { ...address, id: address.id.toString(), userId: address.userId.toString() };
  }

  async create(userId: string, data: {
    receiverName: string;
    receiverPhone: string;
    province: string;
    city: string;
    district: string;
    detailAddress: string;
    isDefault?: number;
  }) {
    const count = await this.prisma.userAddress.count({
      where: { userId: BigInt(userId), deletedAt: null },
    });
    if (count >= 20) throw new BadRequestException('最多保留20条地址');

    if (data.isDefault === 1) {
      await this.prisma.userAddress.updateMany({
        where: { userId: BigInt(userId), deletedAt: null },
        data: { isDefault: 0 },
      });
    }

    const address = await this.prisma.userAddress.create({
      data: { userId: BigInt(userId), ...data },
    });
    this.logger.log(`用户${userId}创建地址`);
    return { ...address, id: address.id.toString(), userId: address.userId.toString() };
  }

  async update(userId: string, id: string, data: any) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('地址不存在');

    if (data.isDefault === 1) {
      await this.prisma.userAddress.updateMany({
        where: { userId: BigInt(userId), deletedAt: null },
        data: { isDefault: 0 },
      });
    }

    const result = await this.prisma.userAddress.update({
      where: { id: BigInt(id) },
      data,
    });
    this.logger.log(`用户${userId}更新地址${id}`);
    return { ...result, id: result.id.toString(), userId: result.userId.toString() };
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
    return { ...result, id: result.id.toString(), userId: result.userId.toString() };
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
    return { ...result, id: result.id.toString(), userId: result.userId.toString() };
  }
}
