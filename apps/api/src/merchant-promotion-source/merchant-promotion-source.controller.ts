import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CreateMerchantPromotionSourceDto,
  MerchantPromotionSourceQueryDto,
  UpdateMerchantPromotionSourceDto,
  UpdateMerchantPromotionSourceStatusDto,
} from './dto/merchant-promotion-source.dto';
import { MerchantPromotionSourceService } from './merchant-promotion-source.service';

@Controller('admin/merchant-promotion-source')
export class AdminMerchantPromotionSourceController {
  constructor(private readonly merchantPromotionSourceService: MerchantPromotionSourceService) {}

  @Get('list')
  @RequirePermission('marketing:activity')
  async list(@Query() dto: MerchantPromotionSourceQueryDto) {
    return this.merchantPromotionSourceService.findAll(dto);
  }

  @Get('detail/:id')
  @RequirePermission('marketing:activity')
  async detail(@Param('id') id: string) {
    return this.merchantPromotionSourceService.findById(id);
  }

  @Post('create')
  @RequirePermission('marketing:activity')
  async create(@Body() dto: CreateMerchantPromotionSourceDto) {
    return this.merchantPromotionSourceService.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('marketing:activity')
  async update(@Param('id') id: string, @Body() dto: UpdateMerchantPromotionSourceDto) {
    return this.merchantPromotionSourceService.update(id, dto);
  }

  @Put('status/:id')
  @RequirePermission('marketing:activity')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateMerchantPromotionSourceStatusDto) {
    return this.merchantPromotionSourceService.updateStatus(id, dto.status);
  }
}
