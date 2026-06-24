import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateMerchantPromotionSourceDto,
  MerchantPromotionSourceQueryDto,
  UpdateMerchantPromotionSourceDto,
} from './dto/merchant-promotion-source.dto';

@Injectable()
export class MerchantPromotionSourceService {
  private readonly logger = new Logger(MerchantPromotionSourceService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(dto: MerchantPromotionSourceQueryDto) {
    const where: any = { deletedAt: null };

    const keyword = dto.keyword?.trim();
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { promotionCode: { contains: keyword } },
        { contactName: { contains: keyword } },
        { contactPhone: { contains: keyword } },
        { scene: { contains: keyword } },
      ];
    }

    if (dto.name?.trim()) where.name = { contains: dto.name.trim() };
    if (dto.promotionCode?.trim()) where.promotionCode = { contains: dto.promotionCode.trim().toUpperCase() };
    if (dto.scene?.trim()) where.scene = { contains: dto.scene.trim() };
    if (dto.status !== undefined) where.status = dto.status;

    const [list, total] = await Promise.all([
      this.prisma.merchantPromotionSource.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.merchantPromotionSource.count({ where }),
    ]);

    this.logger.log(`管理员查询商家推广码列表，共${total}条`);
    return paginate(list.map((item) => this.serialize(item)), total, dto.page, dto.pageSize);
  }

  async findById(id: string) {
    const source = await this.prisma.merchantPromotionSource.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!source) throw new NotFoundException('商家推广码不存在');
    return this.serialize(source);
  }

  async create(dto: CreateMerchantPromotionSourceDto) {
    const name = dto.name.trim();
    const promotionCode = dto.promotionCode.trim().toUpperCase();

    if (!name) throw new BadRequestException('商家名称不能为空');
    if (!promotionCode) throw new BadRequestException('推广码不能为空');

    const existing = await this.prisma.merchantPromotionSource.findFirst({
      where: { promotionCode, deletedAt: null },
    });
    if (existing) throw new BadRequestException('推广码已存在');

    const result = await this.prisma.merchantPromotionSource.create({
      data: {
        name,
        promotionCode,
        contactName: this.cleanText(dto.contactName),
        contactPhone: this.cleanText(dto.contactPhone),
        scene: this.cleanText(dto.scene),
        remark: this.cleanText(dto.remark),
        status: dto.status ?? 1,
      },
    });

    this.logger.log(`创建商家推广码：${result.id} - ${promotionCode}`);
    return this.serialize(result);
  }

  async update(id: string, dto: UpdateMerchantPromotionSourceDto) {
    const source = await this.prisma.merchantPromotionSource.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!source) throw new NotFoundException('商家推广码不存在');

    const updateData: any = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('商家名称不能为空');
      updateData.name = name;
    }

    if (dto.promotionCode !== undefined) {
      const promotionCode = dto.promotionCode.trim().toUpperCase();
      if (!promotionCode) throw new BadRequestException('推广码不能为空');

      if (promotionCode !== source.promotionCode) {
        const existing = await this.prisma.merchantPromotionSource.findFirst({
          where: {
            promotionCode,
            deletedAt: null,
            id: { not: BigInt(id) },
          },
        });
        if (existing) throw new BadRequestException('推广码已存在');
      }

      updateData.promotionCode = promotionCode;
    }

    if (dto.contactName !== undefined) updateData.contactName = this.cleanText(dto.contactName);
    if (dto.contactPhone !== undefined) updateData.contactPhone = this.cleanText(dto.contactPhone);
    if (dto.scene !== undefined) updateData.scene = this.cleanText(dto.scene);
    if (dto.remark !== undefined) updateData.remark = this.cleanText(dto.remark);
    if (dto.status !== undefined) updateData.status = dto.status;

    const result = await this.prisma.merchantPromotionSource.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    this.logger.log(`更新商家推广码：${id}`);
    return this.serialize(result);
  }

  async updateStatus(id: string, status: number) {
    const source = await this.prisma.merchantPromotionSource.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!source) throw new NotFoundException('商家推广码不存在');

    const result = await this.prisma.merchantPromotionSource.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`更新商家推广码状态：${id} -> ${status}`);
    return this.serialize(result);
  }

  private cleanText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private serialize(source: any) {
    return {
      ...source,
      id: source.id.toString(),
    };
  }
}
