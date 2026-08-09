import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PrismaService } from '../common/prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

const HOME_ENTRY_LINK = /^(?:\/pages\/[A-Za-z0-9_./?=&%+\-]+|gift|discount|points|member)$/;
const MAX_HOME_KEYWORDS = 20;
const MAX_HOME_NAV_ICONS = 20;

type NormalizedNavIcon = {
  icon: string;
  name: string;
  linkUrl: string;
  sort: number;
};

class HomeDecorNavIconDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  icon!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(HOME_ENTRY_LINK, { message: '导航跳转必须是合法小程序页面或内置入口' })
  linkUrl!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sort!: number;
}

class HomeDecorConfigDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HOME_KEYWORDS)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(20, { each: true })
  hotKeywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HOME_NAV_ICONS)
  @ValidateNested({ each: true })
  @Type(() => HomeDecorNavIconDto)
  navIcons?: HomeDecorNavIconDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  announcement?: string;
}

@Controller('admin/home-decor')
export class AdminHomeDecorController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('config')
  @RequirePermission('marketing:decor')
  async getConfig() {
    const config = await this.prisma.systemConfig.findFirst({
      where: { groupName: 'home_decor', configKey: 'config' },
    });
    return this.normalizeStoredConfig(this.parseConfig(config?.configValue));
  }

  @Put('config')
  @RequirePermission('marketing:decor')
  async updateConfig(@Body() dto: HomeDecorConfigDto) {
    const hotKeywords = this.normalizeKeywords(dto.hotKeywords || []);
    const navIcons = (dto.navIcons || []).map((item, index) => this.normalizeNavIcon(item, index));
    const announcement = String(dto.announcement || '').trim();
    const config = { hotKeywords, navIcons, announcement };

    const result = await this.prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: 'home_decor', configKey: 'config' } },
      update: {
        configValue: JSON.stringify(config),
        valueType: 'json',
        description: '首页装修配置',
      },
      create: {
        groupName: 'home_decor',
        configKey: 'config',
        configValue: JSON.stringify(config),
        valueType: 'json',
        description: '首页装修配置',
      },
    });
    return { ...result, id: result.id.toString(), value: config };
  }

  private normalizeStoredConfig(value: any) {
    const hotKeywords = this.normalizeKeywords(Array.isArray(value?.hotKeywords) ? value.hotKeywords : []);
    const navIcons: NormalizedNavIcon[] = (Array.isArray(value?.navIcons) ? value.navIcons : [])
      .slice(0, MAX_HOME_NAV_ICONS)
      .map((item: unknown, index: number): NormalizedNavIcon | null => {
        try {
          return this.normalizeNavIcon(item, index);
        } catch {
          return null;
        }
      })
      .filter((item: NormalizedNavIcon | null): item is NormalizedNavIcon => item !== null);
    const announcement = typeof value?.announcement === 'string'
      ? value.announcement.trim().slice(0, 500)
      : '';
    return { hotKeywords, navIcons, announcement };
  }

  private normalizeKeywords(values: unknown[]) {
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const value of values.slice(0, MAX_HOME_KEYWORDS)) {
      if (typeof value !== 'string') continue;
      const keyword = value.trim();
      if (!keyword || keyword.length > 20 || seen.has(keyword)) continue;
      seen.add(keyword);
      normalized.push(keyword);
    }
    return normalized;
  }

  private normalizeNavIcon(value: unknown, index: number): NormalizedNavIcon {
    const record = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const icon = String(record.icon || '').trim();
    const name = String(record.name || '').trim();
    const linkUrl = String(record.linkUrl || '').trim();
    const sort = Number(record.sort ?? 0);
    if (!icon || icon.length > 500) throw new BadRequestException(`第${index + 1}个导航图标地址无效`);
    if (!name || name.length > 30) throw new BadRequestException(`第${index + 1}个导航名称无效`);
    if (!linkUrl || linkUrl.length > 200 || !HOME_ENTRY_LINK.test(linkUrl)) {
      throw new BadRequestException(`第${index + 1}个导航跳转地址无效`);
    }
    if (!Number.isSafeInteger(sort) || sort < 0 || sort > 9999) {
      throw new BadRequestException(`第${index + 1}个导航排序无效`);
    }
    return { icon, name, linkUrl, sort };
  }

  private parseConfig(value?: string | null) {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}
