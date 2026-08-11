import { Controller, Post, Get, Body, Param, Headers, Req, Query, Logger, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const POSITIVE_ID = /^[1-9]\d*$/;

class CreatePaymentDto {
  @IsString()
  @Matches(POSITIVE_ID, { message: '订单ID格式无效' })
  orderId!: string;
}

class WechatCallbackResourceDto {
  @IsOptional() @IsString() @MaxLength(64) original_type?: string;
  @IsString() @IsNotEmpty() @MaxLength(64) algorithm!: string;
  @IsString() @IsNotEmpty() ciphertext!: string;
  @IsOptional() @IsString() associated_data?: string;
  @IsString() @IsNotEmpty() @MaxLength(64) nonce!: string;
}

class WechatCallbackBodyDto {
  @IsOptional() @IsString() @MaxLength(64) id?: string;
  @IsOptional() @IsString() @MaxLength(64) create_time?: string;
  @IsOptional() @IsString() @MaxLength(64) resource_type?: string;
  @IsOptional() @IsString() @MaxLength(64) event_type?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @ValidateNested()
  @Type(() => WechatCallbackResourceDto)
  resource!: WechatCallbackResourceDto;
}

class GetRefundListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsString() @Matches(POSITIVE_ID, { message: '订单ID格式无效' }) orderId?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsString() @MaxLength(64) refundNo?: string;
}

class GetCompensationTaskListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsString() @MaxLength(64) orderNo?: string;
}

class ResolveCompensationTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolution!: string;

  @IsIn(['resolved', 'ignored'])
  @IsString()
  @IsNotEmpty()
  status!: 'resolved' | 'ignored';
}

@Controller('weapp/pay')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async create(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto.orderId, userId);
  }

  @Public()
  @SkipTransform()
  @SkipThrottle()
  @Post('callback')
  @HttpCode(200)
  async callback(
    @Body() body: WechatCallbackBodyDto,
    @Headers() headers: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawBody = req.rawBody;
    try {
      const result = await this.paymentService.handleCallback(body, headers, rawBody);
      if (result?.code === 'FAIL') res.status(500);
      return result;
    } catch (error: any) {
      this.logger.error(`支付回调处理异常: ${error?.message}`, error?.stack);
      // WeChat Pay treats a 2xx callback response as successfully received and stops retrying.
      // Preserve a non-2xx status when verification or durable business processing fails so the
      // notification can be retried instead of being silently lost.
      res.status(500);
      return { code: 'FAIL', message: error?.message || '支付回调处理失败' };
    }
  }

  @Public()
  @SkipTransform()
  @SkipThrottle()
  @Post('refund-callback')
  @HttpCode(200)
  async refundCallback(
    @Body() body: WechatCallbackBodyDto,
    @Headers() headers: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawBody = req.rawBody;
    try {
      const result = await this.paymentService.handleRefundCallback(body, headers, rawBody);
      if (result?.code === 'FAIL') res.status(500);
      return result;
    } catch (error: any) {
      this.logger.error(`退款回调处理异常: ${error?.message}`, error?.stack);
      res.status(500);
      return { code: 'FAIL', message: error?.message || '退款回调处理失败' };
    }
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

@Controller('admin/payment')
@RequirePermission('system:config', 'order:aftersale:refund')
export class PaymentCompensationController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('compensation-tasks')
  async listCompensationTasks(@Query() query: GetCompensationTaskListDto) {
    return this.paymentService.getCompensationTaskList({
      page: query.page || 1,
      pageSize: query.pageSize || 20,
      status: query.status,
      orderNo: query.orderNo,
    });
  }

  @Post('compensation-tasks/:id/resolve')
  async resolveCompensationTask(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveCompensationTaskDto,
  ) {
    return this.paymentService.resolveCompensationTask(id, adminId, dto.resolution, dto.status);
  }
}
