import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FlashSaleService } from './flash-sale.service';
import {
  FlashSaleActivityQueryDto,
  FlashSaleActivityDto,
  FlashSaleActivityStatusDto,
  FlashSaleOrderQueryDto,
  FlashSaleBuyDto,
} from './dto/flash-sale.dto';

@Controller('admin/flash-sale')
export class AdminFlashSaleController {
  constructor(private readonly service: FlashSaleService) {}

  @Get('activity/list')
  @RequirePermission('marketing:activity')
  async activityList(@Query() dto: FlashSaleActivityQueryDto) {
    return this.service.findActivities(dto);
  }

  @Get('activity/detail/:id')
  @RequirePermission('marketing:activity')
  async activityDetail(@Param('id') id: string) {
    return this.service.findActivityById(id);
  }

  @Post('activity/create')
  @RequirePermission('marketing:activity')
  async activityCreate(@Body() dto: FlashSaleActivityDto) {
    return this.service.createActivity(dto);
  }

  @Put('activity/update/:id')
  @RequirePermission('marketing:activity')
  async activityUpdate(@Param('id') id: string, @Body() dto: FlashSaleActivityDto) {
    return this.service.updateActivity(id, dto);
  }

  @Put('activity/status/:id')
  @RequirePermission('marketing:activity')
  async activityStatus(@Param('id') id: string, @Body() dto: FlashSaleActivityStatusDto) {
    return this.service.updateActivityStatus(id, dto);
  }

  @Delete('activity/delete/:id')
  @RequirePermission('marketing:activity')
  async activityDelete(@Param('id') id: string) {
    return this.service.deleteActivity(id);
  }

  @Get('orders')
  @RequirePermission('marketing:activity')
  async orders(@Query() dto: FlashSaleOrderQueryDto) {
    return this.service.findOrders(dto);
  }

  @Get('orders/:id')
  @RequirePermission('marketing:activity')
  async orderDetail(@Param('id') id: string) {
    return this.service.findOrderById(id);
  }

  @Get('stats')
  @RequirePermission('marketing:activity')
  async stats() {
    return this.service.getStats();
  }

  @Put('release-expired-locks')
  @RequirePermission('marketing:activity')
  async releaseExpired() {
    return this.service.releaseExpiredLocks();
  }
}

@Controller('weapp/flash-sale')
export class WeappFlashSaleController {
  constructor(private readonly service: FlashSaleService) {}

  @Public()
  @Get('list')
  async list(@Query() query: { page?: string; pageSize?: string }) {
    return this.service.weappFindActivities({
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 10,
    });
  }

  @Public()
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.service.weappFindActivityById(id);
  }

  @Post('buy')
  async buy(@CurrentUser('id') userId: string, @Body() dto: FlashSaleBuyDto) {
    return this.service.weappBuy(userId, dto);
  }

  @Get('my-orders')
  async myOrders(
    @CurrentUser('id') userId: string,
    @Query() query: { page?: string; pageSize?: string },
  ) {
    return this.service.weappFindMyOrders(userId, {
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 10,
    });
  }
}
