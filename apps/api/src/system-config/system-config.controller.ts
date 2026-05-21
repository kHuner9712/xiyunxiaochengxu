import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
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
}

class BatchUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs!: ConfigItemDto[];
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
    return this.systemConfigService.update(dto.groupName, dto.configKey, dto.configValue);
  }

  @Put('batch-update')
  @RequirePermission('system:config')
  async batchUpdate(@Body() dto: BatchUpdateDto) {
    return this.systemConfigService.batchUpdate(dto.configs);
  }
}
