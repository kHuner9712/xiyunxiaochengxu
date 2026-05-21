import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async createPayment(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(orderId) },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.pending_payment) {
      throw new BadRequestException('订单状态不允许支付');
    }

    const existingPayment = await this.prisma.orderPayment.findFirst({
      where: { orderId: BigInt(orderId), status: 1 },
    });
    if (existingPayment) {
      this.logger.log(`订单${orderId}已存在待支付记录，返回支付参数`);
      return {
        paymentId: existingPayment.id.toString(),
        paymentNo: existingPayment.paymentNo,
        amount: existingPayment.amount,
        orderNo: order.orderNo,
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: Math.random().toString(36).substring(2, 15),
        package: `prepay_id=mock_${existingPayment.paymentNo}`,
        signType: 'RSA',
        paySign: 'mock_sign',
      };
    }

    const paymentNo = `PAY${Date.now()}${Math.random().toString(36).substring(2, 8)}`;

    const payment = await this.prisma.orderPayment.create({
      data: {
        orderId: BigInt(orderId),
        paymentNo,
        amount: order.payAmount ?? 0,
        paymentMethod: 'wechat',
        status: 1,
      },
    });

    this.logger.log(`创建支付记录：${payment.id}，订单${orderId}，金额${payment.amount}分`);

    return {
      paymentId: payment.id.toString(),
      paymentNo: payment.paymentNo,
      amount: payment.amount,
      orderNo: order.orderNo,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: Math.random().toString(36).substring(2, 15),
      package: `prepay_id=mock_${paymentNo}`,
      signType: 'RSA',
      paySign: 'mock_sign',
    };
  }

  async handleCallback(data: { orderId: string; transactionId: string; rawData?: any }) {
    const payment = await this.prisma.orderPayment.findFirst({
      where: { orderId: BigInt(data.orderId), status: 1 },
    });
    if (!payment) throw new NotFoundException('支付记录不存在');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.update({
        where: { id: payment.id },
        data: {
          transactionId: data.transactionId,
          status: 2,
          paidAt: new Date(),
          rawResponse: data.rawData,
        },
      });

      const order = await tx.order.update({
        where: { id: BigInt(data.orderId) },
        data: {
          status: OrderStatus.paid,
          paidAt: new Date(),
          orderLogs: {
            create: {
              operatorType: 'system',
              action: 'pay',
              content: `微信支付成功，交易号：${data.transactionId}`,
            },
          },
        },
      });

      return order;
    });

    this.logger.log(`支付回调处理成功：订单${data.orderId}，交易号${data.transactionId}`);
    return { success: true };
  }

  async queryPaymentStatus(orderId: string) {
    const payment = await this.prisma.orderPayment.findFirst({
      where: { orderId: BigInt(orderId) },
    });
    if (!payment) throw new NotFoundException('支付记录不存在');

    this.logger.log(`查询支付状态：订单${orderId}，状态${payment.status}`);
    return {
      ...payment,
      id: payment.id.toString(),
      orderId: payment.orderId.toString(),
    };
  }
}
