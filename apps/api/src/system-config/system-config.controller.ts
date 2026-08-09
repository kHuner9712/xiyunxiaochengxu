import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { IsString, IsNotEmpty, IsArray, IsIn, IsOptional, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

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
    return this.systemConfigService.update(dto.groupName, dto.configKey, dto.configValue, dto.valueType);
  }

  @Put('batch-update')
  @RequirePermission('system:config')
  async batchUpdate(@Body() dto: BatchUpdateDto) {
    return this.systemConfigService.batchUpdate(dto.configs);
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
