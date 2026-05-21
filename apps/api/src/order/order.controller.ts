import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { DeliverDto } from './dto/deliver.dto';
import { OrderQueryDto } from './dto/order-query.dto';

@Controller('weapp/order')
export class WeappOrderController {
  constructor(private readonly orderService: OrderService) {}

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
  async list(@Query() dto: OrderQueryDto) {
    return this.orderService.findAllAdmin(dto);
  }

  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.orderService.findAdminById(id);
  }

  @Put('status/:id')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.orderService.adminUpdateStatus(id, body.status);
  }

  @Put('remark/:id')
  async remark(@Param('id') id: string, @Body() body: { remark: string }) {
    return this.orderService.adminRemark(id, body.remark);
  }

  @Post('deliver')
  async deliver(@Body() dto: DeliverDto) {
    return this.orderService.adminDeliver(dto);
  }

  @Get('export')
  async export(@Query() dto: OrderQueryDto) {
    return this.orderService.exportOrders(dto);
  }
}
