import { Controller, Post, Get, Body, Param, Headers, Req, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}

class GetRefundListDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  refundNo?: string;
}

@Controller('weapp/pay')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async create(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto.orderId, userId);
  }

  @Public()
  @SkipTransform()
  @Post('callback')
  async callback(@Body() body: any, @Headers() headers: any, @Req() req: any) {
    const rawBody = req.rawBody;
    return this.paymentService.handleCallback(body, headers, rawBody);
  }

  @Public()
  @SkipTransform()
  @Post('refund-callback')
  async refundCallback(@Body() body: any, @Headers() headers: any, @Req() req: any) {
    const rawBody = req.rawBody;
    return this.paymentService.handleRefundCallback(body, headers, rawBody);
  }

  @Get('status/:orderId')
  async queryStatus(@CurrentUser('id') userId: string, @Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId, userId);
  }
}

@Controller('admin/refund')
@RequirePermission('order:refund', 'order:aftersale:refund')
export class RefundController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('list')
  async getList(@Query() query: GetRefundListDto) {
    return this.paymentService.getRefundList({
      page: query.page || 1,
      pageSize: query.pageSize || 20,
      orderId: query.orderId,
      status: query.status,
      refundNo: query.refundNo,
    });
  }

  @Get('detail/:id')
  async getDetail(@Param('id') id: string) {
    return this.paymentService.getRefundDetail(id);
  }

  @Post('sync/:outRefundNo')
  async syncRefund(@Param('outRefundNo') outRefundNo: string) {
    return this.paymentService.syncRefund(outRefundNo);
  }
}

@Controller('admin/payment')
@RequirePermission('system:config', 'order:aftersale:refund')
export class PaymentReconcileController {
  constructor(private readonly reconcileService: PaymentReconcileService) {}

  @Post('reconcile')
  async reconcilePayments() {
    return this.reconcileService.reconcilePendingPayments();
  }
}

@Controller('admin/refund')
@RequirePermission('system:config', 'order:aftersale:refund')
export class RefundReconcileController {
  constructor(private readonly reconcileService: PaymentReconcileService) {}

  @Post('reconcile')
  async reconcileRefunds() {
    return this.reconcileService.reconcilePendingRefunds();
  }
}
