import { Controller, Post, Get, Body, Param, Headers, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { IsString, IsNotEmpty } from 'class-validator';

class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}

@Controller('weapp/pay')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async create(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto.orderId, userId);
  }

  @Public()
  @Post('callback')
  async callback(@Body() body: any, @Headers() headers: any) {
    return this.paymentService.handleCallback(body, headers);
  }

  @Get('status/:orderId')
  async queryStatus(@CurrentUser('id') userId: string, @Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId, userId);
  }
}
