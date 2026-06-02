import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../common/prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class HomeDecorConfigDto {
  @IsOptional()
  @IsArray()
  hotKeywords?: string[];

  @IsOptional()
  @IsArray()
  navIcons?: any[];

  @IsOptional()
  @IsString()
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
    const parsed = this.parseConfig(config?.configValue);
    return {
      hotKeywords: Array.isArray(parsed.hotKeywords) ? parsed.hotKeywords : [],
      navIcons: Array.isArray(parsed.navIcons) ? parsed.navIcons : [],
      announcement: typeof parsed.announcement === 'string' ? parsed.announcement : '',
    };
  }

  @Put('config')
  @RequirePermission('marketing:decor')
  async updateConfig(@Body() dto: HomeDecorConfigDto) {
    const config = {
      hotKeywords: Array.isArray(dto.hotKeywords) ? dto.hotKeywords : [],
      navIcons: Array.isArray(dto.navIcons) ? dto.navIcons : [],
      announcement: dto.announcement || '',
    };
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

  private parseConfig(value?: string | null) {
    if (!value) return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
}
