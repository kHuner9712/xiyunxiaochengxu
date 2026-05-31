import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { normalizeAssetUrl } from '../common/utils/asset-url';

class CreateBannerDto {
  @IsString()
  title!: string;

  @IsString()
  image!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  linkType?: number;

  @IsOptional()
  @IsString()
  linkValue?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

class UpdateBannerDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  linkType?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  linkValue?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

@Controller('admin/banner')
export class AdminBannerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('list')
  @RequirePermission('marketing:banner')
  async list() {
    const banners = await this.prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return banners.map((b) => ({ ...b, id: b.id.toString(), image: normalizeAssetUrl(b.image) }));
  }

  @Post()
  @RequirePermission('marketing:banner')
  async create(@Body() dto: CreateBannerDto) {
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title,
        image: dto.image,
        linkType: dto.linkType ?? null,
        linkValue: dto.linkValue || '',
        sortOrder: dto.sortOrder || 0,
        status: dto.status ?? 1,
      },
    });
    return { ...banner, id: banner.id.toString(), image: normalizeAssetUrl(banner.image) };
  }

  @Put(':id')
  @RequirePermission('marketing:banner')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.update({
      where: { id: BigInt(id) },
      data: dto,
    });
    return { ...banner, id: banner.id.toString(), image: normalizeAssetUrl(banner.image) };
  }

  @Delete(':id')
  @RequirePermission('marketing:banner')
  async delete(@Param('id') id: string) {
    await this.prisma.banner.delete({ where: { id: BigInt(id) } });
    return null;
  }
}
