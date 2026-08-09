import { BadRequestException, Controller, Get, Put, Body, Param } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { IsString, IsNotEmpty, IsArray, IsIn, IsOptional, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

const STOREFRONT_ASSET_URL = /^(?:\/(?!\/)|https?:\/\/)/i;
const CUSTOMER_PHONE = /^[0-9+()\-.\s]{5,40}$/;

class UpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  groupName!: string;

  @IsString()
  @IsNotEmpty()
  configKey!: string;

  @IsString()
  configValue!: string;

  @IsOptional()
  @IsString()
  @IsIn(['string', 'number', 'boolean', 'json'])
  valueType?: string;
}

class ConfigItemDto {
  @IsString()
  @IsNotEmpty()
  groupName!: string;

  @IsString()
  @IsNotEmpty()
  configKey!: string;

  @IsString()
  configValue!: string;

  @IsOptional()
  @IsString()
  @IsIn(['string', 'number', 'boolean', 'json'])
  valueType?: string;
}

class BatchUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs!: ConfigItemDto[];
}

class CustomerServiceConfigDto {
  @IsString()
  @IsIn(['true', 'false'])
  enabled!: string;

  @IsString()
  @IsIn(['phone', 'wechat', 'both'])
  type!: string;

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsString()
  @MaxLength(500)
  wechatQrCode!: string;

  @IsString()
  @MaxLength(100)
  serviceTime!: string;

  @IsString()
  @MaxLength(1000)
  autoReplyText!: string;

  @IsString()
  @MaxLength(50000)
  faqContent!: string;

  @IsString()
  @MaxLength(500)
  notice!: string;
}

@Controller('admin/system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('list')
  @RequirePermission('system:config')
  async findGrouped() {
    return this.systemConfigService.findByGrouped();
  }

  @Get('group/:groupName')
  @RequirePermission('system:config')
  async findByGroup(@Param('groupName') groupName: string) {
    return this.systemConfigService.findByGroup(groupName);
  }

  @Put('update')
  @RequirePermission('system:config')
  async update(@Body() dto: UpdateConfigDto) {
    const normalized = this.normalizeConfigEntry(dto);
    return this.systemConfigService.update(
      normalized.groupName,
      normalized.configKey,
      normalized.configValue,
      normalized.valueType,
    );
  }

  @Put('batch-update')
  @RequirePermission('system:config')
  async batchUpdate(@Body() dto: BatchUpdateDto) {
    return this.systemConfigService.batchUpdate(dto.configs.map((config) => this.normalizeConfigEntry(config)));
  }

  private normalizeConfigEntry<T extends ConfigItemDto | UpdateConfigDto>(entry: T): T {
    const groupName = String(entry.groupName || '').trim();
    const configKey = String(entry.configKey || '').trim();
    let configValue = String(entry.configValue ?? '');

    if (groupName === 'basic') {
      if (configKey === 'shop_name') {
        configValue = configValue.trim();
        if (!configValue || configValue.length > 80) {
          throw new BadRequestException('商城名称必须为1-80个字符');
        }
      } else if (configKey === 'shop_logo') {
        configValue = configValue.trim();
        if (configValue.length > 500 || (configValue && !STOREFRONT_ASSET_URL.test(configValue))) {
          throw new BadRequestException('商城Logo必须是合法站内路径或HTTP(S)地址');
        }
      } else if (configKey === 'customer_service_phone') {
        configValue = configValue.trim();
        if (configValue && !CUSTOMER_PHONE.test(configValue)) {
          throw new BadRequestException('客服电话格式无效');
        }
      }
    }

    return {
      ...entry,
      groupName,
      configKey,
      configValue,
    };
  }
}

@Controller('weapp/customer-service')
export class WeappCustomerServiceController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Public()
  @Get('config')
  async getConfig() {
    return this.systemConfigService.getCustomerServiceConfig();
  }
}

@Controller('admin/customer-service')
export class AdminCustomerServiceController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @RequirePermission('system:customer-service')
  @Get('config')
  async getConfig() {
    return this.systemConfigService.getCustomerServiceConfig();
  }

  @RequirePermission('system:customer-service')
  @Put('config')
  async updateConfig(@Body() dto: CustomerServiceConfigDto) {
    return this.systemConfigService.updateCustomerServiceConfig(dto);
  }
}
