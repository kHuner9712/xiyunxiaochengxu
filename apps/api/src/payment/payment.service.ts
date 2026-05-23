import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { assertOrderTransition } from '../order/order-state-machine';
import { REFUND_STATUS, PAYMENT_STATUS, WECHAT_REFUND_STATUS, RefundStatus, COUPON_STATUS } from '../common/constants';
import { BusinessEventService } from '../common/business-event.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private privateKey: string;
  private wechatpayCertificate: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private businessEvent: BusinessEventService,
  ) {
    const keyPath = this.configService.get<string>('WECHAT_PRIVATE_KEY_PATH', '');
    if (keyPath) {
      try {
        this.privateKey = fs.readFileSync(keyPath, 'utf8');
      } catch {
        this.logger.warn(`商户私钥文件读取失败: ${keyPath}，支付功能将不可用`);
        this.privateKey = '';
      }
    } else {
      this.privateKey = '';
    }

    const certPath = this.configService.get<string>('WECHAT_PLATFORM_CERT_PATH', '');
    if (certPath) {
      try {
        this.wechatpayCertificate = fs.readFileSync(certPath, 'utf8');
      } catch {
        this.logger.warn(`微信平台证书文件读取失败: ${certPath}，回调验签将不可用`);
        this.wechatpayCertificate = '';
      }
    } else {
      this.wechatpayCertificate = '';
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const skipVerify = this.configService.get<string>('WECHAT_SKIP_VERIFY', 'false');

    if (nodeEnv === 'production') {
      const requiredConfigs = [
        { key: 'WECHAT_APP_ID', value: this.configService.get<string>('WECHAT_APP_ID') },
        { key: 'WECHAT_MCH_ID', value: this.configService.get<string>('WECHAT_MCH_ID') },
        { key: 'WECHAT_MCH_SERIAL_NO', value: this.configService.get<string>('WECHAT_MCH_SERIAL_NO') },
        { key: 'WECHAT_API_V3_KEY', value: this.configService.get<string>('WECHAT_API_V3_KEY') },
        { key: 'WECHAT_PRIVATE_KEY_PATH', value: this.configService.get<string>('WECHAT_PRIVATE_KEY_PATH') },
        { key: 'WECHAT_PLATFORM_CERT_PATH', value: this.configService.get<string>('WECHAT_PLATFORM_CERT_PATH') },
        { key: 'WECHAT_NOTIFY_URL', value: this.configService.get<string>('WECHAT_NOTIFY_URL') },
      ];

      const missing = requiredConfigs.filter(c => !c.value);
      if (missing.length > 0) {
        throw new Error(`生产环境缺少必要支付配置: ${missing.map(c => c.key).join(', ')}，支付模块不可启动`);
      }

      const apiV3Key = this.configService.get<string>('WECHAT_API_V3_KEY')!;
      if (Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
        throw new Error('WECHAT_API_V3_KEY 必须为32字节，支付模块不可启动');
      }

      const notifyUrl = this.configService.get<string>('WECHAT_NOTIFY_URL')!;
      if (!notifyUrl.startsWith('https://')) {
        throw new Error('WECHAT_NOTIFY_URL 必须以 https:// 开头，支付模块不可启动');
      }

      if (!this.privateKey) {
        throw new Error('生产环境商户私钥文件不可读(WECHAT_PRIVATE_KEY_PATH)，支付模块不可启动');
      }

      if (!this.wechatpayCertificate) {
        throw new Error('生产环境必须配置微信支付平台证书(WECHAT_PLATFORM_CERT_PATH)，支付模块不可启动');
      }
    }

    if (nodeEnv !== 'production') {
      const hasAnyPaymentConfig = this.configService.get<string>('WECHAT_APP_ID') || this.configService.get<string>('WECHAT_MCH_ID');
      if (!hasAnyPaymentConfig) {
        this.logger.warn('支付配置缺失，支付功能不可用。非生产环境允许继续运行');
      }
    }
  }

  async createPayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(orderId), userId: BigInt(userId) },
      include: { user: { select: { id: true, openid: true } } },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.pending_payment) {
      throw new BadRequestException('订单状态不允许支付');
    }
    if (order.payAmount === null || order.payAmount <= 0) {
      throw new BadRequestException('支付金额异常');
    }

    const appId = this.configService.get<string>('WECHAT_APP_ID')!;
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;

    const existingPayment = await this.prisma.orderPayment.findFirst({
      where: { orderId: BigInt(orderId), status: 1 },
    });

    let prepayId: string;

    if (existingPayment) {
      try {
        const queryResult = await this.queryWechatOrder(order.orderNo);
        if (queryResult.trade_state === 'SUCCESS') {
          await this.processPaymentSuccess(existingPayment.id, order.id, queryResult.transaction_id, queryResult.amount?.total, order);
          throw new BadRequestException('订单已支付，请勿重复支付');
        }
        if (queryResult.trade_state === 'NOTPAY' && queryResult.prepay_id) {
          prepayId = queryResult.prepay_id;
        } else {
          prepayId = await this.createWechatOrder(order, appId, mchId, existingPayment.paymentNo!);
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        prepayId = await this.createWechatOrder(order, appId, mchId, existingPayment.paymentNo!);
      }
    } else {
      const paymentNo = `PAY${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
      await this.prisma.orderPayment.create({
        data: {
          orderId: BigInt(orderId),
          paymentNo,
          amount: order.payAmount!,
          paymentMethod: 'wechat',
          status: 1,
        },
      });
      prepayId = await this.createWechatOrder(order, appId, mchId, paymentNo);
    }

    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const packageStr = `prepay_id=${prepayId}`;
    const paySign = this.signRequest(`${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`);

    this.logger.log(`创建支付参数：订单${orderId}，prepay_id=${prepayId}`);

    return {
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign,
    };
  }

  async handleCallback(body: any, headers: any, rawBody?: string) {
    const apiV3Key = this.configService.get<string>('WECHAT_API_V3_KEY')!;
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;

    const signature = headers['wechatpay-signature'];
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const serialNo = headers['wechatpay-serial'];

    if (!signature || !timestamp || !nonce) {
      this.logger.warn('微信回调缺少必要头部信息');
      return { code: 'FAIL', message: '缺少签名信息' };
    }

    if (!rawBody) {
      this.logger.warn('微信回调缺少rawBody，无法验签');
      return { code: 'FAIL', message: '缺少rawBody' };
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    if (!this.verifyWechatSignature(message, signature)) {
      this.logger.warn('微信回调签名验证失败');
      return { code: 'FAIL', message: '签名验证失败' };
    }

    const configuredSerialNo = this.configService.get<string>('WECHAT_PLATFORM_CERT_SERIAL_NO', '');
    if (configuredSerialNo && serialNo !== configuredSerialNo) {
      this.logger.warn(`微信回调证书序列号不匹配: ${serialNo} vs ${configuredSerialNo}`);
      return { code: 'FAIL', message: '证书序列号不匹配' };
    }

    const resource = body.resource;
    if (!resource) {
      return { code: 'FAIL', message: '缺少resource' };
    }

    let decryptedData: any;
    try {
      const ciphertext = Buffer.from(resource.ciphertext, 'base64');
      const associatedData = resource.associated_data || '';
      const nonceBuf = Buffer.from(resource.nonce, 'utf8');

      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), nonceBuf);
      decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));

      const decrypted = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
      decryptedData = JSON.parse(decrypted.toString('utf8'));
    } catch (e) {
      this.logger.error(`微信回调解密失败: ${(e as Error).message}`);
      return { code: 'FAIL', message: '解密失败' };
    }

    if (decryptedData.mchid !== mchId) {
      this.logger.warn(`微信回调商户号不匹配: ${decryptedData.mchid} vs ${mchId}`);
      return { code: 'FAIL', message: '商户号不匹配' };
    }

    const outTradeNo = decryptedData.out_trade_no;
    const transactionId = decryptedData.transaction_id;
    const tradeState = decryptedData.trade_state;
    const totalAmount = decryptedData.amount?.total;

    if (tradeState !== 'SUCCESS') {
      this.logger.log(`微信回调非成功状态: ${tradeState}，订单号: ${outTradeNo}`);
      return { code: 'SUCCESS', message: '' };
    }

    const order = await this.prisma.order.findFirst({
      where: { orderNo: outTradeNo },
    });
    if (!order) {
      this.logger.warn(`微信回调订单不存在: ${outTradeNo}`);
      this.businessEvent.emitError('payment_order_not_found', 'payment', `支付回调订单不存在: ${outTradeNo}`, outTradeNo, { transactionId, totalAmount });
      return { code: 'FAIL', message: '订单不存在' };
    }

    if (order.status !== OrderStatus.pending_payment) {
      this.logger.log(`微信回调订单已处理: ${outTradeNo}，状态: ${order.status}`);
      return { code: 'SUCCESS', message: '' };
    }

    if (totalAmount !== order.payAmount) {
      this.logger.warn(`微信回调金额不匹配: ${totalAmount} vs ${order.payAmount}，订单号: ${outTradeNo}`);
      this.businessEvent.emitCritical('payment_amount_mismatch', 'payment', `支付回调金额不匹配: 期望${order.payAmount}分, 回调${totalAmount}分`, outTradeNo, { expected: order.payAmount, actual: totalAmount, transactionId });
      return { code: 'FAIL', message: '金额不匹配' };
    }

    const payment = await this.prisma.orderPayment.findFirst({
      where: { orderId: order.id, status: 1 },
    });
    if (!payment) {
      this.logger.warn(`微信回调支付记录不存在: ${outTradeNo}`);
      return { code: 'FAIL', message: '支付记录不存在' };
    }

    await this.processPaymentSuccess(payment.id, order.id, transactionId, totalAmount, order);

    this.logger.log(`微信回调处理成功：订单${outTradeNo}，交易号${transactionId}`);
    return { code: 'SUCCESS', message: '' };
  }

  async getPaymentStatus(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(orderId), userId: BigInt(userId) },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const payment = await this.prisma.orderPayment.findFirst({
      where: { orderId: BigInt(orderId) },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('支付记录不存在');

    return {
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      orderStatus: order.status,
      paymentStatus: payment.status,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      paidAt: payment.paidAt?.toISOString() || null,
      transactionId: payment.transactionId || null,
    };
  }

  async processPaymentSuccess(paymentId: bigint, orderId: bigint, transactionId: string, totalAmount: number | null | undefined, order: any) {
    await this.prisma.$transaction(async (tx) => {
      const existingPayment = await tx.orderPayment.findUnique({ where: { id: paymentId } });
      if (!existingPayment) {
        this.logger.error(`支付成功处理时支付记录不存在: ${paymentId}`);
        throw new InternalServerErrorException('支付记录不存在');
      }

      if (existingPayment.status === PAYMENT_STATUS.SUCCESS) {
        if (existingPayment.transactionId !== transactionId) {
          this.logger.error(`支付记录 transactionId 不一致: 支付${paymentId}现有${existingPayment.transactionId}, 回调${transactionId}`);
          throw new BadRequestException('支付交易号不一致');
        }

        const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
        if (!currentOrder) {
          this.logger.error(`支付成功处理时订单不存在: ${orderId}`);
          throw new InternalServerErrorException('订单不存在');
        }

        const processedStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.delivered, OrderStatus.completed];
        if (processedStatuses.includes(currentOrder.status)) {
          if (order.couponId) {
            const coupon = await tx.userCoupon.findFirst({ where: { id: order.couponId } });
            if (coupon && coupon.status === COUPON_STATUS.LOCKED) {
              await tx.userCoupon.update({
                where: { id: order.couponId },
                data: { status: COUPON_STATUS.USED },
              });
              this.logger.log(`支付成功补偿: 优惠券${order.couponId}从 LOCKED 修复为 USED`);
            }
          }
          this.logger.log(`支付成功幂等处理: 支付${paymentId}已成功处理，订单${orderId}状态${currentOrder.status}`);
          return;
        }

        if (currentOrder.status === OrderStatus.pending_payment) {
          this.logger.warn(`支付半成功状态补偿: 支付${paymentId}已SUCCESS，但订单${orderId}仍pending_payment，执行补偿修复`);
          this.businessEvent.emitInfo('payment_half_success_fix', 'reconcile', `支付半成功补偿: 支付已SUCCESS但订单仍pending_payment，已修复`, orderId.toString(), { paymentId: paymentId.toString(), transactionId });

          const updateResult = await tx.order.updateMany({
            where: { id: orderId, status: OrderStatus.pending_payment },
            data: { status: OrderStatus.pending_delivery, paidAt: new Date() },
          });

          if (updateResult.count === 0) {
            this.logger.error(`支付半成功补偿失败: 订单${orderId}状态已变更，无法修复`);
            throw new BadRequestException('订单状态已变更，补偿失败');
          }

          await tx.orderLog.create({
            data: {
              orderId,
              operatorType: 'system',
              action: 'payment_reconcile_fix',
              content: `支付半成功补偿: 支付已SUCCESS但订单仍pending_payment，已修复为pending_delivery，交易号：${transactionId}`,
            },
          });

          if (order.couponId) {
            const coupon = await tx.userCoupon.findFirst({ where: { id: order.couponId } });
            if (coupon) {
              if (coupon.status === COUPON_STATUS.LOCKED) {
                await tx.userCoupon.update({
                  where: { id: order.couponId },
                  data: { status: COUPON_STATUS.USED },
                });
              } else if (coupon.status === COUPON_STATUS.USED) {
                this.logger.log(`支付半成功补偿: 优惠券${order.couponId}已USED，幂等跳过`);
              } else {
                this.logger.warn(`支付半成功补偿: 优惠券${order.couponId}状态异常(${coupon.status})，不盲目修改`);
                this.businessEvent.emitWarn('coupon_status_abnormal', 'coupon', `优惠券状态异常(${coupon.status})，不盲目修改`, order.couponId.toString(), { couponId: order.couponId.toString(), status: coupon.status, orderId: orderId.toString() });
              }
            }
          }

          return;
        }

        this.logger.error(`支付成功处理时订单状态异常: ${orderId}，状态: ${currentOrder.status}`);
        throw new BadRequestException('订单状态异常');
      }

      const updateResult = await tx.order.updateMany({
        where: { 
          id: orderId, 
          status: OrderStatus.pending_payment 
        },
        data: {
          status: OrderStatus.pending_delivery,
          paidAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
        if (!currentOrder) {
          this.logger.error(`支付成功处理时订单不存在: ${orderId}`);
          throw new InternalServerErrorException('订单不存在');
        }

        const processedStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.delivered, OrderStatus.completed];
        if (processedStatuses.includes(currentOrder.status)) {
          this.logger.log(`支付成功幂等处理: 订单${orderId}已处于${currentOrder.status}状态`);
          return;
        }

        this.logger.error(`支付成功处理时订单状态异常: ${orderId}，状态: ${currentOrder.status}`);
        throw new BadRequestException('订单状态异常');
      }

      assertOrderTransition(OrderStatus.pending_payment, OrderStatus.pending_delivery, '支付成功');

      await tx.orderPayment.update({
        where: { id: paymentId },
        data: {
          transactionId,
          status: PAYMENT_STATUS.SUCCESS,
          paidAt: new Date(),
          rawResponse: { totalAmount, transactionId },
        },
      });

      await tx.orderLog.create({
        data: {
          orderId,
          operatorType: 'system',
          action: 'pay',
          content: `微信支付成功，交易号：${transactionId}`,
        },
      });

      if (order.couponId) {
        const coupon = await tx.userCoupon.findFirst({ where: { id: order.couponId } });
        if (coupon) {
          if (coupon.status === COUPON_STATUS.LOCKED) {
            await tx.userCoupon.update({
              where: { id: order.couponId },
              data: { status: COUPON_STATUS.USED },
            });
          } else if (coupon.status === COUPON_STATUS.USED) {
            this.logger.log(`支付成功: 优惠券${order.couponId}已USED，幂等跳过`);
          } else {
            this.logger.warn(`支付成功: 优惠券${order.couponId}状态异常(${coupon.status})，不盲目修改`);
            this.businessEvent.emitWarn('coupon_status_abnormal', 'coupon', `优惠券状态异常(${coupon.status})，不盲目修改`, order.couponId.toString(), { couponId: order.couponId.toString(), status: coupon.status, orderId: orderId.toString() });
          }
        }
      }
    });
  }

  async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    const successAmount = wechatData.amount?.refund || refund.refundAmount;

    await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.orderRefund.updateMany({
        where: {
          id: refund.id,
          status: { in: [REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING] },
        },
        data: {
          status: REFUND_STATUS.PROCESSING,
          refundId: refundId,
          notifiedAt: new Date(),
          rawResponse: wechatData,
        },
      });

      if (claimResult.count === 0) {
        const currentRefund = await tx.orderRefund.findUnique({ where: { id: refund.id } });
        if (!currentRefund) {
          this.logger.error(`退款记录不存在: ${refund.id}`);
          throw new Error(`退款记录不存在: ${refund.id}`);
        }
        if (currentRefund.status === REFUND_STATUS.SUCCESS) {
          this.logger.log(`退款已被其他进程处理成功: ${refund.outRefundNo}`);
          return;
        }
        this.logger.error(`退款状态异常，无法抢占处理权: ${refund.id}当前状态${currentRefund.status}`);
        throw new Error(`退款状态异常: ${currentRefund.status}`);
      }

      if (refund.aftersaleId) {
        const aftersaleId = refund.aftersaleId as bigint;

        const aftersale = await tx.aftersaleOrder.findFirst({
          where: { id: aftersaleId },
          include: { orderItem: true, order: true },
        });

        if (aftersale) {
          await tx.aftersaleOrder.update({
            where: { id: aftersale.id },
            data: {
              status: 'refunded',
              refundedAt: new Date(),
              aftersaleLogs: {
                create: {
                  operatorType: 'system',
                  action: 'refund',
                  content: `微信退款成功，金额: ${successAmount}分`,
                },
              },
            },
          });

          const aftersaleWithRelations = aftersale as any;

          if (aftersaleWithRelations.type === 2 && aftersaleWithRelations.orderItem) {
            const sku = await tx.productSku.findFirst({ where: { id: aftersaleWithRelations.orderItem.skuId } });
            if (sku) {
              await tx.productSku.update({
                where: { id: aftersaleWithRelations.orderItem.skuId },
                data: { stock: { increment: aftersaleWithRelations.orderItem.quantity }, sales: { decrement: aftersaleWithRelations.orderItem.quantity } },
              });
              await tx.productStockLog.create({
                data: {
                  productId: aftersaleWithRelations.orderItem.productId,
                  skuId: aftersaleWithRelations.orderItem.skuId,
                  type: 4,
                  quantity: aftersaleWithRelations.orderItem.quantity,
                  beforeStock: sku.stock,
                  afterStock: sku.stock + aftersaleWithRelations.orderItem.quantity,
                  reason: '售后退款归还库存',
                },
              });
            }
          }

          if (aftersaleWithRelations.refundAmount && aftersaleWithRelations.refundAmount > 0 && aftersaleWithRelations.order?.payAmount) {
            const deductedPoints = Math.floor(aftersaleWithRelations.refundAmount / 100);
            if (deductedPoints > 0) {
              const user = await tx.user.findFirst({ where: { id: aftersaleWithRelations.userId } });
              if (user && user.availablePoints >= deductedPoints) {
                await tx.user.update({
                  where: { id: aftersaleWithRelations.userId },
                  data: { availablePoints: { decrement: deductedPoints } },
                });
                await tx.pointsRecord.create({
                  data: {
                    userId: aftersaleWithRelations.userId,
                    type: 2,
                    points: deductedPoints,
                    balance: user.availablePoints - deductedPoints,
                    source: 'aftersale_refund',
                    sourceId: aftersaleWithRelations.orderId,
                    description: `售后退款扣回${deductedPoints}积分`,
                  },
                });
              }
            }
          }

          if (aftersaleWithRelations.order?.pointsDeducted > 0 && aftersaleWithRelations.refundAmount && aftersaleWithRelations.order?.payAmount) {
            const restorePoints = Math.floor(aftersaleWithRelations.order.pointsDeducted * aftersaleWithRelations.refundAmount / aftersaleWithRelations.order.payAmount);
            if (restorePoints > 0) {
              const user = await tx.user.findFirst({ where: { id: aftersaleWithRelations.userId } });
              if (user) {
                await tx.user.update({
                  where: { id: aftersaleWithRelations.userId },
                  data: { availablePoints: { increment: restorePoints } },
                });
                await tx.pointsRecord.create({
                  data: {
                    userId: aftersaleWithRelations.userId,
                    type: 1,
                    points: restorePoints,
                    balance: user.availablePoints + restorePoints,
                    source: 'aftersale_refund_restore',
                    sourceId: aftersaleWithRelations.orderId,
                    description: `售后退款归还抵扣积分${restorePoints}`,
                  },
                });
              }
            }
          }

          const otherAftersales = await tx.aftersaleOrder.findFirst({
            where: {
              orderId: aftersaleWithRelations.orderId,
              id: { not: aftersaleWithRelations.id },
              status: { notIn: ['closed', 'rejected', 'refunded'] },
            },
          });
          if (!otherAftersales && aftersaleWithRelations.order) {
            const restoreStatus = aftersaleWithRelations.order.completedAt ? 'completed' : 'delivered';
            await tx.order.update({
              where: { id: aftersaleWithRelations.orderId },
              data: { status: restoreStatus },
            });
          }
        }
      }

      await tx.orderRefund.update({
        where: { id: refund.id },
        data: { status: REFUND_STATUS.SUCCESS },
      });
    });
  }

  private async createWechatOrder(order: any, appId: string, mchId: string, outTradeNo: string): Promise<string> {
    if (!this.privateKey) {
      throw new BadRequestException('商户私钥未配置，无法发起支付');
    }

    const notifyUrl = this.configService.get<string>('WECHAT_NOTIFY_URL')!;
    const description = order.orderItems?.[0]?.productName || `订单${order.orderNo}`;

    const body = {
      appid: appId,
      mchid: mchId,
      description: description.substring(0, 127),
      out_trade_no: order.orderNo,
      notify_url: notifyUrl,
      amount: {
        total: order.payAmount,
        currency: 'CNY',
      },
      payer: {
        openid: order.user?.openid || '',
      },
    };

    const serialNo = this.configService.get<string>('WECHAT_MCH_SERIAL_NO')!;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const signMessage = `POST\n/v3/pay/transactions/jsapi\n${timestamp}\n${nonceStr}\n${JSON.stringify(body)}\n`;
    const signature = this.signRequest(signMessage);

    try {
      const response = await axios.post('https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi', body, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`,
          'Accept': 'application/json',
        },
      });

      return response.data.prepay_id;
    } catch (error) {
      const err = error as Error;
      const errData = (error as any).response?.data;
      this.logger.error(`微信下单失败: ${JSON.stringify(errData) || err.message}`);
      throw new BadRequestException(`微信下单失败: ${errData?.message || err.message}`);
    }
  }

  async queryWechatOrder(outTradeNo: string): Promise<any> {
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;
    const serialNo = this.configService.get<string>('WECHAT_MCH_SERIAL_NO')!;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const signMessage = `GET\n/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchId}\n${timestamp}\n${nonceStr}\n`;
    const signature = this.signRequest(signMessage);

    try {
      const response = await axios.get(
        `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchId}`,
        {
          headers: {
            'Authorization': `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`,
            'Accept': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`微信查询订单失败: ${err.message}`);
      throw error;
    }
  }

  private verifyWechatSignature(message: string, signature: string): boolean {
    if (!this.wechatpayCertificate) {
      const skipVerify = this.configService.get<string>('WECHAT_SKIP_VERIFY', 'false');
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv !== 'production' && skipVerify === 'true') {
        this.logger.warn('微信平台证书未配置，已跳过签名验证（仅限非生产环境）');
        return true;
      }
      this.logger.error('微信平台证书未配置，签名验证失败');
      return false;
    }
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      return verify.verify(this.wechatpayCertificate, signature, 'base64');
    } catch (e) {
      this.logger.error(`微信回调签名验证异常: ${(e as Error).message}`);
      return false;
    }
  }

  private signRequest(message: string): string {
    if (!this.privateKey) return '';
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();
    return sign.sign(this.privateKey, 'base64');
  }

  async createRefund(params: {
    orderId: string;
    aftersaleId?: string;
    refundAmount: number;
    reason?: string;
  }) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(params.orderId) },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'aftersale') {
      throw new BadRequestException('订单状态不允许退款');
    }
    if (!order.payment || order.payment.status !== PAYMENT_STATUS.SUCCESS) {
      throw new BadRequestException('订单未支付成功');
    }
    if (params.refundAmount > order.payAmount!) {
      throw new BadRequestException('退款金额不能超过订单实付金额');
    }

    // 退款幂等: 检查同一售后单是否已有 pending 或 success 的退款单
    if (params.aftersaleId) {
      const existingRefund = await this.prisma.orderRefund.findFirst({
        where: {
          aftersaleId: BigInt(params.aftersaleId),
          status: { in: [REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING, REFUND_STATUS.SUCCESS] },
        },
      });

      if (existingRefund) {
        if (existingRefund.status === REFUND_STATUS.SUCCESS) {
          throw new BadRequestException('该售后单已成功退款，请勿重复退款');
        }
        this.logger.log(`退款幂等处理: 售后单${params.aftersaleId}已有${existingRefund.status}状态退款单`);
        return {
          refundId: existingRefund.id.toString(),
          refundNo: existingRefund.refundNo,
          outRefundNo: existingRefund.outRefundNo,
        };
      }
    }

    // 退款累计金额限制: 计算同一订单已成功和待处理的退款金额
    const existingRefunds = await this.prisma.orderRefund.findMany({
      where: {
        orderId: BigInt(params.orderId),
        status: { in: [REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING, REFUND_STATUS.SUCCESS] },
      },
    });

    const totalRefundedAmount = existingRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
    if (totalRefundedAmount + params.refundAmount > order.payAmount!) {
      throw new BadRequestException(`累计退款金额不能超过订单实付金额。当前已退款${totalRefundedAmount}分，申请${params.refundAmount}分，订单实付${order.payAmount}分`);
    }

    if (!order.payment) {
      throw new BadRequestException('订单支付信息不存在');
    }

    const appId = this.configService.get<string>('WECHAT_APP_ID')!;
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;
    const refundNotifyUrl = this.configService.get<string>('WECHAT_REFUND_NOTIFY_URL')!;
    const outRefundNo = `REFUND${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
    const refundNo = outRefundNo;

    const requestBody = {
      out_trade_no: order.orderNo,
      out_refund_no: outRefundNo,
      reason: params.reason || '用户申请退款',
      notify_url: refundNotifyUrl,
      amount: {
        refund: params.refundAmount,
        total: order.payAmount,
        currency: 'CNY',
      },
    };

    const request = {
      app_id: appId,
      mch_id: mchId,
      ...requestBody,
    };

    // A. 先创建 initiating 记录，确保微信受理后本地必有追踪
    let initiatingRefund;
    try {
      initiatingRefund = await this.prisma.orderRefund.create({
        data: {
          refundNo,
          orderId: BigInt(params.orderId),
          aftersaleId: params.aftersaleId ? BigInt(params.aftersaleId) : null,
          paymentId: order.payment.id,
          outTradeNo: order.orderNo,
          transactionId: order.payment.transactionId,
          outRefundNo,
          refundId: null,
          refundAmount: params.refundAmount,
          totalAmount: order.payAmount!,
          status: REFUND_STATUS.INITIATING,
          reason: params.reason,
          rawRequest: request,
          rawResponse: Prisma.DbNull,
        },
      });
    } catch (error) {
      this.logger.error(`创建退款意图记录失败: ${outRefundNo}`, (error as Error).message);
      throw new InternalServerErrorException('退款处理失败，请稍后重试');
    }

    // B. 调用微信退款接口
    let response: any;
    if (this.privateKey) {
      const serialNo = this.configService.get<string>('WECHAT_MCH_SERIAL_NO')!;
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = crypto.randomBytes(16).toString('hex');
      const signMessage = `POST\n/v3/refund/domestic/refunds\n${timestamp}\n${nonceStr}\n${JSON.stringify(requestBody)}\n`;
      const signature = this.signRequest(signMessage);
      const authHeader = `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;

      try {
        response = await axios.post('https://api.mch.weixin.qq.com/v3/refund/domestic/refunds', requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            Accept: 'application/json',
          },
        });
      } catch (error) {
        // C. 微信调用失败：将 OrderRefund 标记为 failed
        const err = error as any;
        const errData = err.response?.data;
        this.logger.error(`微信退款请求失败: ${JSON.stringify(errData) || err.message}`);

        try {
          await this.prisma.orderRefund.update({
            where: { id: initiatingRefund.id },
            data: {
              status: REFUND_STATUS.FAILED,
              rawResponse: errData || { error: err.message },
            },
          });
        } catch (updateErr) {
          this.logger.error(`更新退款记录为 failed 失败: ${outRefundNo}`, (updateErr as Error).message);
        }

        throw new BadRequestException(`微信退款请求失败: ${errData?.message || err.message}`);
      }
    } else {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      const mockRefund = this.configService.get<string>('WECHAT_REFUND_MOCK', 'false');
      if (nodeEnv === 'production' && mockRefund === 'true') {
        try {
          await this.prisma.orderRefund.update({
            where: { id: initiatingRefund.id },
            data: { status: REFUND_STATUS.FAILED },
          });
        } catch {}
        throw new BadRequestException('生产环境禁止使用退款 Mock');
      }
      if (mockRefund !== 'true') {
        try {
          await this.prisma.orderRefund.update({
            where: { id: initiatingRefund.id },
            data: { status: REFUND_STATUS.FAILED },
          });
        } catch {}
        throw new BadRequestException('商户私钥未配置，无法发起退款');
      }
      this.logger.warn('微信退款 Mock 模式（仅限非生产环境测试）');
    }

    // D. 微信调用成功：更新 OrderRefund 为 pending + 更新售后单
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.orderRefund.update({
          where: { id: initiatingRefund.id },
          data: {
            status: REFUND_STATUS.PENDING,
            refundId: response?.data?.refund_id || null,
            rawResponse: response?.data || null,
          },
        });

        if (params.aftersaleId) {
          await tx.aftersaleOrder.update({
            where: { id: BigInt(params.aftersaleId) },
            data: {
              status: 'pending_refund',
              aftersaleLogs: {
                create: {
                  operatorType: 'admin',
                  action: 'request_refund',
                  content: `管理员发起退款申请，金额: ${params.refundAmount}分`,
                },
              },
            },
          });
        }
      });

      this.logger.log(`创建退款成功: ${refundNo}, 订单: ${order.orderNo}`);
      return { refundId: initiatingRefund.id.toString(), refundNo, outRefundNo };
    } catch (error) {
      this.logger.error(`微信退款已受理但本地状态更新失败，退款记录保留 initiating 状态，可通过 admin sync 修复。退款单号: ${outRefundNo}`, (error as Error).message);
      throw new InternalServerErrorException('退款已提交但状态更新失败，请通过退款同步接口修复');
    }
  }

  async handleRefundCallback(body: any, headers: any, rawBody?: string) {
    const apiV3Key = this.configService.get<string>('WECHAT_API_V3_KEY')!;
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;

    const signature = headers['wechatpay-signature'];
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const serialNo = headers['wechatpay-serial'];

    if (!signature || !timestamp || !nonce) {
      this.logger.warn('微信退款回调缺少必要头部信息');
      return { code: 'FAIL', message: '缺少签名信息' };
    }

    if (!rawBody) {
      this.logger.warn('微信退款回调缺少rawBody，无法验签');
      return { code: 'FAIL', message: '缺少rawBody' };
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    if (!this.verifyWechatSignature(message, signature)) {
      this.logger.warn('微信退款回调签名验证失败');
      return { code: 'FAIL', message: '签名验证失败' };
    }

    const configuredSerialNo = this.configService.get<string>('WECHAT_PLATFORM_CERT_SERIAL_NO', '');
    if (configuredSerialNo && serialNo !== configuredSerialNo) {
      this.logger.warn(`微信退款回调证书序列号不匹配: ${serialNo} vs ${configuredSerialNo}`);
      return { code: 'FAIL', message: '证书序列号不匹配' };
    }

    let decryptedData: any;
    try {
      const resource = body.resource;
      if (!resource) {
        throw new Error('缺少resource');
      }

      const ciphertext = Buffer.from(resource.ciphertext, 'base64');
      const associatedData = resource.associated_data || '';
      const nonceBuf = Buffer.from(resource.nonce, 'utf8');

      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), nonceBuf);
      decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));

      const decrypted = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
      decryptedData = JSON.parse(decrypted.toString('utf8'));
    } catch (e) {
      this.logger.error(`微信退款回调解密失败: ${(e as Error).message}`);
      return { code: 'FAIL', message: '解密失败' };
    }

    if (decryptedData.mchid !== mchId) {
      this.logger.warn(`微信退款回调商户号不匹配: ${decryptedData.mchid} vs ${mchId}`);
      return { code: 'FAIL', message: '商户号不匹配' };
    }

    const outRefundNo = decryptedData.out_refund_no;
    const refundId = decryptedData.refund_id;
    const refundStatus = decryptedData.refund_status;
    const successAmount = decryptedData.amount?.refund;
    const totalAmount = decryptedData.amount?.total;

    const refund = await this.prisma.orderRefund.findFirst({
      where: { outRefundNo },
    });

    if (!refund) {
      this.logger.error(`微信退款回调退款记录不存在(孤儿回调): ${outRefundNo}`);
      this.businessEvent.emitCritical('refund_orphan_callback', 'refund', `退款孤儿回调: 本地无退款记录${outRefundNo}`, outRefundNo, { outRefundNo, refundId, refundStatus });

      try {
        await this.prisma.refundCallbackLog.create({
          data: {
            outRefundNo,
            rawBody: rawBody ? { raw: rawBody } : Prisma.DbNull,
            decryptedData,
            headers: { signature, timestamp, nonce, serialNo },
            status: 'orphan',
          },
        });
      } catch (logErr) {
        this.logger.error(`写入孤儿回调日志失败: ${outRefundNo}`, (logErr as Error).message);
      }

      return { code: 'FAIL', message: '退款记录不存在' };
    }

    // 1. 基本校验
    if (refund.outRefundNo !== outRefundNo) {
      this.logger.error(`微信退款回调退款单号不匹配: ${refund.outRefundNo} vs ${outRefundNo}`);
      return { code: 'FAIL', message: '退款单号不匹配' };
    }

    // 2. 退款状态校验
    if (refund.status === REFUND_STATUS.SUCCESS) {
      this.logger.log(`微信退款回调已处理成功，跳过: ${outRefundNo}`);
      return { code: 'SUCCESS', message: '' };
    }

    if (refund.status === REFUND_STATUS.PROCESSING) {
      this.logger.warn(`微信退款回调退款记录正在处理中: ${outRefundNo}，返回 FAIL 让微信重试`);
      return { code: 'FAIL', message: '退款正在处理中' };
    }

    if (refund.status === REFUND_STATUS.FAILED) {
      this.logger.warn(`微信退款回调退款记录已失败: ${outRefundNo}，返回 FAIL 让微信重试`);
      return { code: 'FAIL', message: '退款记录已失败' };
    }

    if (refund.status === REFUND_STATUS.CLOSED || refund.status === REFUND_STATUS.ABNORMAL) {
      this.logger.warn(`微信退款回调退款记录已终态(${refund.status})，拒绝处理: ${outRefundNo}`);
      return { code: 'FAIL', message: `退款记录已终态: ${refund.status}` };
    }

    if (refundStatus === WECHAT_REFUND_STATUS.SUCCESS) {
      // 3. 金额校验
      if (successAmount !== refund.refundAmount) {
        this.logger.error(`微信退款回调金额不匹配: 退款${refund.id}期望${refund.refundAmount}分, 回调${successAmount}分`);
        this.businessEvent.emitCritical('refund_amount_mismatch', 'refund', `退款回调金额不匹配: 期望${refund.refundAmount}分, 回调${successAmount}分`, outRefundNo, { expected: refund.refundAmount, actual: successAmount, refundId });
        return { code: 'FAIL', message: '退款金额不匹配' };
      }

      if (totalAmount !== undefined && totalAmount !== refund.totalAmount) {
        this.logger.error(`微信退款回调订单总金额不匹配: 退款${refund.id}期望${refund.totalAmount}分, 回调${totalAmount}分`);
        this.businessEvent.emitCritical('refund_total_amount_mismatch', 'refund', `退款回调订单总金额不匹配: 期望${refund.totalAmount}分, 回调${totalAmount}分`, outRefundNo, { expected: refund.totalAmount, actual: totalAmount, refundId });
        return { code: 'FAIL', message: '订单总金额不匹配' };
      }

      // 4. 在单个事务中完成：抢占处理权 -> 副作用 -> 标记成功
      try {
        await this.processWechatRefundSuccess(refund, refundId, decryptedData);
      } catch (error) {
        this.logger.error(`退款回调事务失败，退款记录保留 processing 状态，微信将重试: ${outRefundNo}`, (error as Error).message);
        this.businessEvent.emitError('refund_processing_failed', 'refund', `退款处理失败: ${(error as Error).message}`, outRefundNo, { outRefundNo, error: (error as Error).message });
        return { code: 'FAIL', message: '退款处理失败，将重试' };
      }
    } else if (refundStatus === WECHAT_REFUND_STATUS.CLOSED || refundStatus === WECHAT_REFUND_STATUS.ABNORMAL) {
      const localRefundStatus: RefundStatus = refundStatus === WECHAT_REFUND_STATUS.CLOSED ? REFUND_STATUS.CLOSED : REFUND_STATUS.ABNORMAL;
      
      await this.prisma.$transaction(async (tx) => {
        await tx.orderRefund.update({
          where: { id: refund.id },
          data: {
            status: localRefundStatus,
            notifiedAt: new Date(),
            rawResponse: decryptedData,
          },
        });

        // 退款失败时，不要直接关闭售后单，保持待退款状态并记录日志
        if (refund.aftersaleId) {
          const aftersaleId = refund.aftersaleId as bigint;
          await tx.aftersaleOrder.update({
            where: { id: aftersaleId },
            data: {
              status: 'pending_refund', // 保持待退款状态，避免误关闭
              aftersaleLogs: {
                create: {
                  operatorType: 'system',
                  action: 'refund_failed',
                  content: `微信退款失败，状态: ${refundStatus}，请管理员检查后重试`,
                },
              },
            },
          });
        }
      });
    } else {
      this.logger.warn(`微信退款回调未知状态: ${refundStatus}`);
      return { code: 'FAIL', message: '未知退款状态' };
    }

    this.logger.log(`微信退款回调处理成功: ${outRefundNo}, 状态: ${refundStatus}`);
    return { code: 'SUCCESS', message: '' };
  }

  async syncRefund(outRefundNo: string) {
    const refund = await this.prisma.orderRefund.findFirst({
      where: { outRefundNo },
    });

    if (!refund) {
      const orphanLog = await this.prisma.refundCallbackLog.findFirst({
        where: { outRefundNo, status: 'orphan' },
        orderBy: { createdAt: 'desc' },
      });

      if (orphanLog) {
        this.logger.log(`syncRefund: 发现孤儿回调记录，outRefundNo=${outRefundNo}，需要人工处理`);
        return {
          synced: false,
          reason: 'orphan_callback_found',
          message: '发现孤儿回调记录，退款记录缺失，需要人工创建退款记录后重试',
          orphanLog: {
            id: orphanLog.id.toString(),
            decryptedData: orphanLog.decryptedData,
            createdAt: orphanLog.createdAt,
          },
        };
      }

      throw new NotFoundException(`退款记录不存在: ${outRefundNo}`);
    }

    if (refund.status === REFUND_STATUS.SUCCESS) {
      return { synced: true, reason: 'already_success', message: '退款已成功' };
    }

    let wechatResult: any;
    try {
      wechatResult = await this.queryRefund(outRefundNo);
    } catch (error) {
      this.logger.error(`syncRefund: 查询微信退款状态失败: ${outRefundNo}`, (error as Error).message);
      return {
        synced: false,
        reason: 'wechat_query_failed',
        message: `查询微信退款状态失败: ${(error as Error).message}`,
      };
    }

    const wechatStatus = wechatResult.status;
    this.logger.log(`syncRefund: 微信退款状态=${wechatStatus}, outRefundNo=${outRefundNo}, 本地状态=${refund.status}`);

    if (wechatStatus === 'SUCCESS') {
      const wechatRefundAmount = wechatResult.amount?.refund;
      const wechatTotalAmount = wechatResult.amount?.total;

      if (wechatRefundAmount !== refund.refundAmount) {
        this.logger.error(`syncRefund: 退款金额不匹配: ${outRefundNo} 期望${refund.refundAmount}分, 微信${wechatRefundAmount}分`);
        this.businessEvent.emitCritical('refund_sync_amount_mismatch', 'refund', `退款同步金额不匹配: 期望${refund.refundAmount}分, 微信${wechatRefundAmount}分`, outRefundNo, { expected: refund.refundAmount, actual: wechatRefundAmount });
        return {
          synced: false,
          reason: 'amount_mismatch',
          message: `退款金额不匹配: 本地${refund.refundAmount}分, 微信${wechatRefundAmount}分`,
        };
      }

      if (wechatTotalAmount !== undefined && wechatTotalAmount !== refund.totalAmount) {
        this.logger.error(`syncRefund: 订单总金额不匹配: ${outRefundNo} 期望${refund.totalAmount}分, 微信${wechatTotalAmount}分`);
        return {
          synced: false,
          reason: 'total_amount_mismatch',
          message: `订单总金额不匹配: 本地${refund.totalAmount}分, 微信${wechatTotalAmount}分`,
        };
      }

      if (([REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING] as string[]).includes(refund.status)) {
        try {
          await this.processWechatRefundSuccess(refund, wechatResult.refund_id || refund.refundId, wechatResult);
          this.businessEvent.emitInfo('refund_sync_success', 'reconcile', `退款同步补偿成功: ${outRefundNo}`, outRefundNo, { outRefundNo, localStatus: refund.status });
        } catch (error) {
          this.logger.error(`syncRefund: 调用 processWechatRefundSuccess 失败: ${outRefundNo}`, (error as Error).message);
          return {
            synced: false,
            reason: 'process_failed',
            message: `本地副作用处理失败: ${(error as Error).message}`,
          };
        }

        try {
          await this.prisma.refundCallbackLog.updateMany({
            where: { outRefundNo, status: 'orphan' },
            data: { status: 'processed' },
          });
        } catch (logErr) {
          this.logger.error(`syncRefund: 标记孤儿回调日志失败: ${outRefundNo}`, (logErr as Error).message);
        }

        return { synced: true, reason: 'wechat_success_processed', message: '微信退款已成功，本地副作用已补偿完成' };
      }

      return { synced: false, reason: 'unexpected_local_status', message: `本地退款状态异常(${refund.status})，无法自动补偿` };
    }

    if (wechatStatus === 'CLOSED' || wechatStatus === 'ABNORMAL') {
      const localStatus = wechatStatus === 'CLOSED' ? REFUND_STATUS.CLOSED : REFUND_STATUS.ABNORMAL;

      await this.prisma.$transaction(async (tx) => {
        await tx.orderRefund.update({
          where: { id: refund.id },
          data: {
            status: localStatus,
            rawResponse: wechatResult,
          },
        });

        if (refund.aftersaleId) {
          const aftersaleId = refund.aftersaleId as bigint;
          await tx.aftersaleOrder.update({
            where: { id: aftersaleId },
            data: {
              status: 'pending_refund',
              aftersaleLogs: {
                create: {
                  operatorType: 'admin',
                  action: 'sync_refund_failed',
                  content: `管理员同步退款状态，微信退款${wechatStatus}，请检查后重试`,
                },
              },
            },
          });
        }
      });

      return { synced: true, reason: `wechat_${wechatStatus.toLowerCase()}`, message: `微信退款状态: ${wechatStatus}，本地已同步` };
    }

    if (wechatStatus === 'PROCESSING') {
      if (refund.status === REFUND_STATUS.INITIATING) {
        await this.prisma.orderRefund.update({
          where: { id: refund.id },
          data: {
            status: REFUND_STATUS.PENDING,
            refundId: wechatResult.refund_id || refund.refundId,
            rawResponse: wechatResult,
          },
        });

        if (refund.aftersaleId) {
          const aftersaleId = refund.aftersaleId as bigint;
          await this.prisma.aftersaleOrder.update({
            where: { id: aftersaleId },
            data: {
              status: 'pending_refund',
              aftersaleLogs: {
                create: {
                  operatorType: 'admin',
                  action: 'sync_refund',
                  content: `管理员同步退款状态，微信处理中，金额: ${refund.refundAmount}分`,
                },
              },
            },
          });
        }
      }

      return { synced: true, reason: 'wechat_processing', message: '微信退款处理中，等待回调' };
    }

    return { synced: false, reason: 'unknown_wechat_status', message: `微信退款未知状态: ${wechatStatus}` };
  }

  async queryRefund(outRefundNo: string) {
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;
    const serialNo = this.configService.get<string>('WECHAT_MCH_SERIAL_NO')!;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const signMessage = `GET\n/v3/refund/domestic/refunds/${outRefundNo}?mchid=${mchId}\n${timestamp}\n${nonceStr}\n`;
    const signature = this.signRequest(signMessage);

    const response = await axios.get(`https://api.mch.weixin.qq.com/v3/refund/domestic/refunds/${outRefundNo}?mchid=${mchId}`, {
      headers: {
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`,
        Accept: 'application/json',
      },
    });
    return response.data;
  }

  // 管理后台退款查询方法
  async getRefundList(params: {
    page: number;
    pageSize: number;
    orderId?: string;
    status?: string;
    refundNo?: string;
  }) {
    const { page, pageSize, orderId, status, refundNo } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (orderId) {
      where.orderId = BigInt(orderId);
    }
    if (status) {
      where.status = status;
    }
    if (refundNo) {
      where.refundNo = refundNo;
    }

    const [refunds, total] = await Promise.all([
      this.prisma.orderRefund.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { id: true, orderNo: true, totalAmount: true, payAmount: true } },
        },
      }),
      this.prisma.orderRefund.count({ where }),
    ]);

    return {
      list: refunds.map(r => ({
        ...r,
        id: r.id.toString(),
        orderId: r.orderId?.toString() || null,
        aftersaleId: r.aftersaleId?.toString() || null,
        paymentId: r.paymentId?.toString() || null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getRefundDetail(id: string) {
    const refund = await this.prisma.orderRefund.findUnique({
      where: { id: BigInt(id) },
      include: {
        order: true,
      },
    });
    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }
    return {
      ...refund,
      id: refund.id.toString(),
      orderId: refund.orderId?.toString() || null,
      aftersaleId: refund.aftersaleId?.toString() || null,
      paymentId: refund.paymentId?.toString() || null,
    };
  }
}
