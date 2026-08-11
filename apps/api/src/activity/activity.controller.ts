import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CheckoutReadyProductionActivityService } from './checkout-ready-production-activity.service';
import { ActivityCheckoutService } from './activity-checkout.service';
import { ContentService } from '../content/content.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { ActivityFeedQueryDto, ActivityStatusDto, AddActivityProductDto, UpdateActivityDto } from './dto/update-activity.dto';

@Controller('weapp/activity')
export class WeappActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly contentService: ContentService,
    private readonly activityCheckoutService: ActivityCheckoutService,
  ) {}

  @Public()
  @Get('active')
  async findActive() {
    return this.activityService.findActive();
  }

  @Public()
  @Get('feed')
  async findActivityFeed(@Query() query: ActivityFeedQueryDto) {
    return this.contentService.findActivityFeed(query.tab, query.page, query.pageSize);
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    const service = this.activityService as CheckoutReadyProductionActivityService;
    return service.findPublishedById(id);
  }

  @Public()
  @Get('type/:type')
  async findByType(@Param('type') type: string) {
    return this.activityService.findByType(type);
  }

  @Post(':id/preview')
  async previewOrder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ActivityCheckoutDto,
  ) {
    return this.activityCheckoutService.preview(userId, id, dto);
  }

  @Post(':id/order')
  async createOrder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ActivityCheckoutDto,
  ) {
    return this.activityCheckoutService.createOrder(userId, id, dto);
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
  async update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activityService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing:activity')
  async delete(@Param('id') id: string) {
    return this.activityService.delete(id);
  }

  @Put(':id/status')
  @RequirePermission('marketing:activity')
  async updateStatus(@Param('id') id: string, @Body() body: ActivityStatusDto) {
    return this.activityService.updateStatus(id, body.status);
  }

  @Post(':activityId/product')
  @RequirePermission('marketing:activity')
  async addProduct(@Param('activityId') activityId: string, @Body() dto: AddActivityProductDto) {
    return this.activityService.addProduct(activityId, dto);
  }

  @Delete('product/:id')
  @RequirePermission('marketing:activity')
  async removeProduct(@Param('id') id: string) {
    return this.activityService.removeProduct(id);
  }
}
