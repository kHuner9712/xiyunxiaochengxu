import { BadRequestException, Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { normalizeAssetUrl } from '../common/utils/asset-url';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';

class CreateBannerDto {
  @IsString() @IsNotEmpty() @MaxLength(100) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) image!: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2, 3]) linkType?: number;
  @IsOptional() @IsString() @MaxLength(200) linkValue?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
}

class UpdateBannerDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) image?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2, 3]) linkType?: number;
  @IsOptional() @IsString() @MaxLength(200) linkValue?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
}

@Controller('admin/banner')
export class AdminBannerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('list')
  @RequirePermission('marketing:banner')
  async list() {
    const banners = await this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
    return banners.map((banner) => ({
      ...banner,
      id: banner.id.toString(),
      image: normalizeAssetUrl(banner.image),
    }));
  }

  @Post()
  @RequirePermission('marketing:banner')
  async create(@Body() dto: CreateBannerDto) {
    this.assertLinkContract(dto.linkType ?? 0, dto.linkValue || '');
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title.trim(),
        image: dto.image.trim(),
        linkType: dto.linkType ?? 0,
        linkValue: dto.linkValue?.trim() || '',
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 1,
      },
    });
    return { ...banner, id: banner.id.toString(), image: normalizeAssetUrl(banner.image) };
  }

  @Put(':id')
  @RequirePermission('marketing:banner')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    const bannerId = parsePositiveBigIntId(id, 'Banner');
    const current = await this.prisma.banner.findUnique({ where: { id: bannerId } });
    if (!current) throw new BadRequestException('Banner不存在');
    const nextType = dto.linkType ?? current.linkType ?? 0;
    const nextValue = dto.linkValue !== undefined ? dto.linkValue.trim() : (current.linkValue || '');
    this.assertLinkContract(nextType, nextValue);
    const banner = await this.prisma.banner.update({
      where: { id: bannerId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.image !== undefined ? { image: dto.image.trim() } : {}),
        ...(dto.linkType !== undefined ? { linkType: dto.linkType } : {}),
        ...(dto.linkValue !== undefined ? { linkValue: dto.linkValue.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return { ...banner, id: banner.id.toString(), image: normalizeAssetUrl(banner.image) };
  }

  @Delete(':id')
  @RequirePermission('marketing:banner')
  async delete(@Param('id') id: string) {
    const bannerId = parsePositiveBigIntId(id, 'Banner');
    await this.prisma.banner.delete({ where: { id: bannerId } });
    return null;
  }

  private assertLinkContract(linkType: number, linkValue: string) {
    if (linkType === 0) return;
    const normalized = linkValue.trim();
    if (!normalized) throw new BadRequestException('配置跳转类型后必须填写跳转目标');
    if ((linkType === 1 || linkType === 2) && !/^[1-9]\d*$/.test(normalized)) {
      throw new BadRequestException(linkType === 1 ? '商品ID无效' : '活动ID无效');
    }
    if (linkType === 3 && !normalized.startsWith('/pages/')) {
      throw new BadRequestException('小程序页面路径必须以 /pages/ 开头');
    }
  }
}
