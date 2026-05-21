import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

class PayCallbackDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsOptional()
  rawData?: any;
}

@Controller('weapp/pay')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('callback')
  async callback(@Body() dto: PayCallbackDto) {
    return this.paymentService.handleCallback(dto);
  }

  @Get('status/:orderId')
  async queryStatus(@Param('orderId') orderId: string) {
    return this.paymentService.queryPaymentStatus(orderId);
  }
}
