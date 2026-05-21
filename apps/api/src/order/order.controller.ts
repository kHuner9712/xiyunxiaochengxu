import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { DeliverDto, BatchDeliverDto } from './dto/deliver.dto';
import { OrderQueryDto } from './dto/order-query.dto';

@Controller('weapp/order')
export class WeappOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('count')
  async getOrderCount(@CurrentUser('id') userId: string) {
    return this.orderService.getOrderCountByUser(userId);
  }

  @Post('confirm')
  async confirm(
    @CurrentUser('id') userId: string,
    @Body() body: { items: { skuId: number; quantity: number }[]; addressId?: number; couponId?: number; pointsDeduct?: number },
  ) {
    return this.orderService.confirm(userId, {
      items: body.items.map((i) => ({ skuId: String(i.skuId), quantity: i.quantity })),
      addressId: body.addressId ? String(body.addressId) : undefined,
      couponId: body.couponId ? String(body.couponId) : undefined,
      pointsDeduct: body.pointsDeduct,
    });
  }

  @Post('create')
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.orderService.create(userId, {
      addressId: String(dto.addressId),
      couponId: dto.couponId ? String(dto.couponId) : undefined,
      pointsDeduct: dto.pointsDeduct,
      remark: dto.remark,
      items: dto.items.map((i) => ({ skuId: String(i.skuId), quantity: i.quantity })),
    });
  }

  @Post('pay/:id')
  async pay(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return { orderId: id, message: '请通过支付模块发起支付' };
  }

  @Get('list')
  async list(@CurrentUser('id') userId: string, @Query() dto: OrderQueryDto) {
    return this.orderService.findByUser(userId, dto);
  }

  @Get('detail/:id')
  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.orderService.findById(userId, id);
  }

  @Put('cancel/:id')
  async cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.orderService.cancel(userId, id);
  }

  @Put('confirm-receive/:id')
  async confirmReceive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.orderService.confirmReceive(userId, id);
  }
}

@Controller('admin/order')
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('list')
  @RequirePermission('order:list')
  async list(@Query() dto: OrderQueryDto) {
    return this.orderService.findAllAdmin(dto);
  }

  @Get('detail/:id')
  @RequirePermission('order:detail')
  async detail(@Param('id') id: string) {
    return this.orderService.findAdminById(id);
  }

  @Put('status/:id')
  @RequirePermission('order:deliver')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.orderService.adminUpdateStatus(id, body.status);
  }

  @Put('remark/:id')
  @RequirePermission('order:remark')
  async remark(@Param('id') id: string, @Body() body: { remark: string }) {
    return this.orderService.adminRemark(id, body.remark);
  }

  @Put('cancel/:id')
  @RequirePermission('order:cancel')
  async cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.orderService.adminCancel(id, body.reason);
  }

  @Get('delivery-list')
  @RequirePermission('order:list')
  async deliveryList(@Query() dto: OrderQueryDto) {
    return this.orderService.findDeliveryList(dto);
  }

  @Post('batch-deliver')
  @RequirePermission('order:deliver')
  async batchDeliver(@Body() dto: BatchDeliverDto) {
    return this.orderService.batchDeliver(dto);
  }

  @Post('deliver')
  @RequirePermission('order:deliver')
  async deliver(@Body() dto: DeliverDto) {
    return this.orderService.adminDeliver(dto);
  }

  @Get('export')
  @RequirePermission('order:list')
  async export(@Query() dto: OrderQueryDto) {
    return this.orderService.exportOrders(dto);
  }
}
