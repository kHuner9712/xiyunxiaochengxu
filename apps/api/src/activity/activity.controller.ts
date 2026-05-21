import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';

@Controller('weapp/activity')
export class WeappActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Public()
  @Get('active')
  async findActive() {
    return this.activityService.findActive();
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.activityService.findById(id);
  }

  @Public()
  @Get('type/:type')
  async findByType(@Param('type') type: string) {
    return this.activityService.findByType(type);
  }
}

@Controller('admin/activity')
export class AdminActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('list')
  @RequirePermission('marketing:activity')
  async list(@Query() dto: ActivityQueryDto) {
    return this.activityService.findAllAdmin(dto);
  }

  @Get(':id')
  @RequirePermission('marketing:activity')
  async detail(@Param('id') id: string) {
    return this.activityService.findById(id);
  }

  @Post()
  @RequirePermission('marketing:activity')
  async create(@Body() dto: CreateActivityDto) {
    return this.activityService.create(dto);
  }

  @Put(':id')
  @RequirePermission('marketing:activity')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateActivityDto>) {
    return this.activityService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing:activity')
  async delete(@Param('id') id: string) {
    return this.activityService.delete(id);
  }

  @Put(':id/status')
  @RequirePermission('marketing:activity')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: number },
  ) {
    return this.activityService.updateStatus(id, body.status);
  }

  @Post(':activityId/product')
  @RequirePermission('marketing:activity')
  async addProduct(
    @Param('activityId') activityId: string,
    @Body() dto: { productId: number; skuId?: number; activityPrice?: number; activityStock?: number; limitPerUser?: number },
  ) {
    return this.activityService.addProduct(activityId, dto);
  }

  @Delete('product/:id')
  @RequirePermission('marketing:activity')
  async removeProduct(@Param('id') id: string) {
    return this.activityService.removeProduct(id);
  }
}
