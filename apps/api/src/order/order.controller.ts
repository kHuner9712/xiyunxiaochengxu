import { Controller, Get, Post, Put, Body, Param, Query, Res } from '@nestjs/common';
import { OrderService } from './order.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { DeliverDto, BatchDeliverDto } from './dto/deliver.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { Response } from 'express';

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
    @Body() body: { items: { skuId: string; quantity: number }[]; addressId?: string; pickupStoreId?: string; fulfillmentType?: string; couponId?: string; pointsDeduct?: number },
  ) {
    return this.orderService.confirm(userId, {
      items: body.items,
      addressId: body.addressId || undefined,
      pickupStoreId: body.pickupStoreId || undefined,
      fulfillmentType: body.fulfillmentType || undefined,
      couponId: body.couponId || undefined,
      pointsDeduct: body.pointsDeduct,
    });
  }

  @Post('create')
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.orderService.create(userId, {
      addressId: dto.addressId,
      pickupStoreId: dto.pickupStoreId || undefined,
      fulfillmentType: dto.fulfillmentType || undefined,
      couponId: dto.couponId || undefined,
      pointsDeduct: dto.pointsDeduct,
      remark: dto.remark,
      items: dto.items.map((i) => ({ skuId: i.skuId, quantity: i.quantity })),
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
  @RequirePermission('order:export')
  @SkipTransform()
  async export(@Query() dto: OrderQueryDto, @Res() res: Response) {
    const rows = await this.orderService.exportOrders(dto);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const filename = `orders-${y}${m}${d}.csv`;

    const headers = [
      '订单号',
      '用户昵称',
      '用户手机号',
      '订单状态',
      '配送方式',
      '商品数量',
      '商品明细',
      '订单金额',
      '优惠金额',
      '运费',
      '积分抵扣',
      '实付金额',
      '收货人',
      '手机号',
      '省市区地址',
      '下单时间',
      '支付时间',
    ];

    const toYuan = (amount: number) => (Number(amount || 0) / 100).toFixed(2);
    const fmt = (value: any) => {
      if (!value) return '';
      const dt = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toLocaleString('zh-CN', { hour12: false });
    };
    const esc = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const typeLabel = (value: string) => (value === 'pickup' ? '到店自提' : '快递配送');

    const lines = [
      headers.map(esc).join(','),
      ...rows.map((row: any) =>
        [
          row.orderNo,
          row.userNickname,
          row.userPhone,
          row.status,
          typeLabel(row.fulfillmentType),
          row.itemCount,
          row.itemDetails,
          toYuan(row.totalAmount),
          toYuan((row.discountAmount || 0) + (row.couponAmount || 0) + (row.activityDiscountAmount || 0)),
          toYuan(row.freightAmount),
          toYuan(row.pointsAmount),
          toYuan(row.payAmount),
          row.consignee,
          row.consigneePhone,
          row.address,
          fmt(row.createdAt),
          fmt(row.paidAt),
        ]
          .map(esc)
          .join(','),
      ),
    ];

    const csv = `\uFEFF${lines.join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  }
}
