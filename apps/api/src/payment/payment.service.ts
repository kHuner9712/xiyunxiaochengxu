import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { assertOrderTransition } from '../order/order-state-machine';
import { OrderService } from '../order/order.service';
import { REFUND_STATUS, PAYMENT_STATUS, WECHAT_REFUND_STATUS, RefundStatus, COUPON_STATUS } from '../common/constants';
import { BusinessEventService } from '../common/business-event.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import axios from 'axios';
import { ShareService } from '../share/share.service';
import { generatePaymentNo, generateRefundNo } from '@baby-mall/shared';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private privateKey: string;
  private wechatpayCertificate: string;
  private platformCertificates = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private businessEvent: BusinessEventService,
    private orderService: OrderService,
    private shareService: ShareService,
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
    const certSerialNo = this.configService.get<string>('WECHAT_PLATFORM_CERT_SERIAL_NO', '');
    if (certPath) {
      try {
        this.wechatpayCertificate = fs.readFileSync(certPath, 'utf8');
        if (certSerialNo) {
          this.platformCertificates.set(certSerialNo, this.wechatpayCertificate);
        }
      } catch {
        this.logger.warn(`微信平台证书文件读取失败: ${certPath}，回调验签将不可用`);
        this.wechatpayCertificate = '';
      }
    } else {
      this.wechatpayCertificate = '';
    }

    const certMapRaw = this.configService.get<string>('WECHAT_PLATFORM_CERT_MAP', '');
    if (certMapRaw) {
      try {
        const certMap = JSON.parse(certMapRaw) as Record<string, string>;
        Object.entries(certMap).forEach(([serial, filePath]) => {
          if (!serial || !filePath) return;
          if (!fs.existsSync(filePath)) return;
          this.platformCertificates.set(serial, fs.readFileSync(filePath, 'utf8'));
        });
      } catch (error) {
        this.logger.warn(`WECHAT_PLATFORM_CERT_MAP 解析失败: ${(error as Error).message}`);
      }
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
        { key: 'WECHAT_REFUND_NOTIFY_URL', value: this.configService.get<string>('WECHAT_REFUND_NOTIFY_URL') },
      ];

      const missing = requiredConfigs.filter(c => !c.value);
      if (missing.length > 0) {
        this.logger.error(`生产环境缺少必要支付配置: ${missing.map(c => c.key).join(', ')}，支付功能将不可用`);
        process.exit(1);
      }

      const apiV3Key = this.configService.get<string>('WECHAT_API_V3_KEY')!;
      if (apiV3Key && Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
        this.logger.error('WECHAT_API_V3_KEY 必须为32字节，支付功能将不可用');
        process.exit(1);
      }

      const notifyUrl = this.configService.get<string>('WECHAT_NOTIFY_URL')!;
      if (notifyUrl && !notifyUrl.startsWith('https://')) {
        this.logger.error('WECHAT_NOTIFY_URL 必须以 https:// 开头，支付功能将不可用');
        process.exit(1);
      }

      const refundNotifyUrl = this.configService.get<string>('WECHAT_REFUND_NOTIFY_URL')!;
      if (refundNotifyUrl && !refundNotifyUrl.startsWith('https://')) {
        this.logger.error('WECHAT_REFUND_NOTIFY_URL 必须以 https:// 开头，支付功能将不可用');
        process.exit(1);
      }

      if (!this.privateKey) {
        this.logger.error('生产环境商户私钥文件不可读(WECHAT_PRIVATE_KEY_PATH)，支付功能将不可用');
        process.exit(1);
      }

      if (!this.wechatpayCertificate) {
        this.logger.error('生产环境必须配置微信支付平台证书(WECHAT_PLATFORM_CERT_PATH)，回调验签将不可用');
        process.exit(1);
      }

      if (skipVerify === 'true') {
        this.logger.error('生产环境禁止 WECHAT_SKIP_VERIFY=true，支付回调验签不可关闭');
        process.exit(1);
      }
    }

    if (nodeEnv !== 'production') {
      const hasAnyPaymentConfig = this.configService.get<string>('WECHAT_APP_ID') || this.configService.get<string>('WECHAT_MCH_ID');
      if (!hasAnyPaymentConfig) {
        this.logger.warn('支付配置缺失，支付功能不可用。非生产环境允许继续运行');
      }
    }
  }

  private isWechatPaymentConfigured(): boolean {
    return !!(
      this.configService.get<string>('WECHAT_APP_ID') &&
      this.configService.get<string>('WECHAT_MCH_ID') &&
      this.configService.get<string>('WECHAT_MCH_SERIAL_NO') &&
      this.configService.get<string>('WECHAT_API_V3_KEY') &&
      this.privateKey
    );
  }

  private ensureWechatPaymentAvailable(): void {
    if (!this.isWechatPaymentConfigured()) {
      throw new BadRequestException('微信支付暂未开通，请联系客服');
    }
  }

  isPaymentStatusSyncAvailable(): boolean {
    return this.isWechatPaymentConfigured();
  }

  private isPrismaP2002(error: unknown): boolean {
    const knownRequestError = (Prisma as any).PrismaClientKnownRequestError;
    return (
      (typeof knownRequestError === 'function' && error instanceof knownRequestError && (error as any).code === 'P2002') ||
      (typeof error === 'object' && error !== null && (error as any).code === 'P2002')
    );
  }

  private getPrismaUniqueTargets(error: unknown): string[] {
    const meta = typeof error === 'object' && error !== null ? (error as any).meta : undefined;
    const rawTarget = meta?.target ?? meta?.constraint;
    const targets = Array.isArray(rawTarget) ? rawTarget : rawTarget ? [rawTarget] : [];
    return targets.map((target) => String(target).toLowerCase().replace(/[^a-z0-9]/g, ''));
  }

  private hasPrismaUniqueTarget(error: unknown, candidates: string[]): boolean {
    const targets = this.getPrismaUniqueTargets(error);
    const normalizedCandidates = candidates.map((target) => target.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return targets.some((target) => normalizedCandidates.some((candidate) => target === candidate || target.includes(candidate)));
  }

  private isOrderPaymentOrderIdConflict(error: unknown): boolean {
    return this.isPrismaP2002(error) && this.hasPrismaUniqueTarget(error, [
      'orderId',
      'order_id',
      'order_payments_order_id_key',
      'OrderPayment_orderId_key',
    ]);
  }

  private isPaymentNoConflict(error: unknown): boolean {
    return this.isPrismaP2002(error) && this.hasPrismaUniqueTarget(error, [
      'paymentNo',
      'payment_no',
      'uk_payment_no',
      'order_payments_payment_no_key',
    ]);
  }

  private async loadExistingPaymentRecord(orderId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: BigInt(orderId), userId: BigInt(userId) },
        include: { user: { select: { id: true, openid: true } } },
      });
      if (!order) throw new NotFoundException('订单不存在');
      if (order.status !== OrderStatus.pending_payment) {
        throw new BadRequestException('订单已支付');
      }
      if (order.payAmount === null || order.payAmount <= 0) {
        throw new BadRequestException('支付金额异常');
      }

      const existingPayment = await tx.orderPayment.findFirst({
        where: { orderId: BigInt(orderId) },
      });
      return existingPayment ? { order, payment: existingPayment, created: false } : null;
    });
  }

  private async findOrCreatePaymentRecord(orderId: string, userId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const paymentNo = generatePaymentNo();
      try {
        return await this.prisma.$transaction(async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: BigInt(orderId), userId: BigInt(userId) },
            include: { user: { select: { id: true, openid: true } } },
          });
          if (!order) throw new NotFoundException('订单不存在');
          if (order.status !== OrderStatus.pending_payment) {
            throw new BadRequestException('订单已支付');
          }
          if (order.payAmount === null || order.payAmount <= 0) {
            throw new BadRequestException('支付金额异常');
          }

          const existingPayment = await tx.orderPayment.findFirst({
            where: { orderId: BigInt(orderId) },
          });
          if (existingPayment) {
            return { order, payment: existingPayment, created: false };
          }

          const payment = await tx.orderPayment.create({
            data: {
              orderId: BigInt(orderId),
              paymentNo,
              amount: order.payAmount!,
              paymentMethod: 'wechat',
              status: PAYMENT_STATUS.CREATED,
            },
          });
          return { order, payment, created: true };
        });
      } catch (error) {
        if (this.isOrderPaymentOrderIdConflict(error)) {
          const existing = await this.loadExistingPaymentRecord(orderId, userId);
          if (existing) return existing;
          throw error;
        }
        if (this.isPaymentNoConflict(error)) {
          this.logger.warn(`支付单号 ${paymentNo} 冲突，第 ${attempt + 1} 次重试`);
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException('支付单号生成失败，请重试');
  }

  async createPayment(orderId: string, userId: string) {
    this.ensureWechatPaymentAvailable();
    const { order, payment, created } = await this.findOrCreatePaymentRecord(orderId, userId);

    const appId = this.configService.get<string>('WECHAT_APP_ID')!;
    const mchId = this.configService.get<string>('WECHAT_MCH_ID')!;

    let prepayId: string;

    if (!created) {
      try {
        const queryResult = await this.queryWechatOrder(order.orderNo);
        if (queryResult.trade_state === 'SUCCESS') {
          await this.processPaymentSuccess(payment.id, order.id, queryResult.transaction_id, queryResult.amount?.total, order);
          throw new BadRequestException('订单已支付，请勿重复支付');
        }
        if (queryResult.trade_state === 'NOTPAY' && queryResult.prepay_id) {
          prepayId = queryResult.prepay_id;
        } else {
          prepayId = await this.createWechatOrder(order, appId, mchId);
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        prepayId = await this.createWechatOrder(order, appId, mchId);
      }
    } else {
      prepayId = await this.createWechatOrder(order, appId, mchId);
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

  private validateCallbackTimestamp(timestamp: string): { code: string; message: string } | null {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || ts <= 0) {
      this.logger.warn(`微信回调时间戳无效: ${timestamp}`);
      return { code: 'FAIL', message: '回调时间戳无效' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
      this.logger.warn(`微信回调时间戳过期: ${timestamp}, 当前: ${now}`);
      return { code: 'FAIL', message: '回调时间戳过期' };
    }
    return null;
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

    const timestampError = this.validateCallbackTimestamp(timestamp);
    if (timestampError) return timestampError;

    if (!rawBody) {
      this.logger.warn('微信回调缺少rawBody，无法验签');
      return { code: 'FAIL', message: '缺少rawBody' };
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    if (!this.verifyWechatSignature(message, signature, serialNo)) {
      this.logger.warn('微信回调签名验证失败');
      return { code: 'FAIL', message: '签名验证失败' };
    }

    if (serialNo && this.platformCertificates.size > 0 && !this.platformCertificates.has(serialNo)) {
      this.logger.warn(`微信回调证书序列号不匹配: ${serialNo}`);
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
      if (order.status === OrderStatus.cancelled) {
        this.businessEvent.emitCritical(
          'payment_callback_on_cancelled_order',
          'payment',
          `支付回调到达但订单已取消: ${outTradeNo}，微信交易号: ${transactionId}，已创建补偿任务`,
          outTradeNo,
          { outTradeNo, transactionId, totalAmount, orderStatus: order.status },
        );
        await this.createPaymentCompensationTask({
          orderNo: outTradeNo,
          transactionId,
          amount: totalAmount,
          reason: 'cancelled_order_paid_callback',
          callbackPayload: {
            headers: { signature, timestamp, nonce, serialNo },
            body,
            decryptedData,
          },
        });
        return { code: 'SUCCESS', message: '' };
      }
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
    const getCurrentStatus = async () => {
      const order = await this.prisma.order.findFirst({
        where: { id: BigInt(orderId), userId: BigInt(userId) },
      });
      if (!order) throw new NotFoundException('订单不存在');

      const payment = await this.prisma.orderPayment.findFirst({
        where: { orderId: BigInt(orderId) },
        orderBy: { createdAt: 'desc' },
      });
      if (!payment) throw new NotFoundException('支付记录不存在');
      return { order, payment };
    };

    const buildResult = (order: any, payment: any, extras?: {
      confirming?: boolean;
      tradeState?: string;
      displayStatus?: 'success' | 'pending' | 'confirming' | 'closed' | 'failed' | 'cancelled';
      canRetryPay?: boolean;
      message?: string;
    }) => ({
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      orderStatus: order.status,
      paymentStatus: payment.status,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      paidAt: payment.paidAt?.toISOString() || null,
      transactionId: payment.transactionId || null,
      confirming: extras?.confirming ?? false,
      tradeState: extras?.tradeState,
      displayStatus: extras?.displayStatus,
      canRetryPay: extras?.canRetryPay ?? false,
      message: extras?.message,
    });

    const { order, payment } = await getCurrentStatus();

    const paidStatuses: OrderStatus[] = [
      OrderStatus.pending_delivery,
      OrderStatus.pending_pickup,
      OrderStatus.delivered,
      OrderStatus.completed,
    ];

    if (paidStatuses.includes(order.status)) {
      return buildResult(order, payment, {
        confirming: false,
        displayStatus: 'success',
        canRetryPay: false,
      });
    }

    if (order.status === OrderStatus.cancelled) {
      return buildResult(order, payment, {
        confirming: false,
        displayStatus: 'cancelled',
        canRetryPay: false,
      });
    }

    if (
      order.status === OrderStatus.pending_payment &&
      payment.status === PAYMENT_STATUS.CREATED &&
      this.isPaymentStatusSyncAvailable()
    ) {
      try {
        const wechatResult = await this.queryWechatOrder(order.orderNo);
        const tradeState = wechatResult?.trade_state;

        if (tradeState === 'SUCCESS') {
          await this.processPaymentSuccess(
            payment.id,
            order.id,
            wechatResult.transaction_id,
            wechatResult.amount?.total,
            order,
          );
          const refreshed = await getCurrentStatus();
          return buildResult(refreshed.order, refreshed.payment, {
            confirming: false,
            tradeState,
            displayStatus: 'success',
            canRetryPay: false,
          });
        }

        if (tradeState === 'NOTPAY' || tradeState === 'USERPAYING') {
          return buildResult(order, payment, {
            confirming: true,
            tradeState,
            displayStatus: 'pending',
            canRetryPay: true,
            message: '支付结果确认中',
          });
        }

        if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
          return buildResult(order, payment, {
            confirming: false,
            tradeState,
            displayStatus: tradeState === 'CLOSED' ? 'closed' : 'failed',
            canRetryPay: true,
          });
        }

        return buildResult(order, payment, {
          confirming: true,
          tradeState,
          displayStatus: 'confirming',
          canRetryPay: true,
          message: '支付结果确认中',
        });
      } catch (error) {
        this.logger.warn(`主动查询微信支付状态失败，订单${order.orderNo}: ${(error as Error).message}`);
        return buildResult(order, payment, {
          confirming: true,
          displayStatus: 'confirming',
          canRetryPay: true,
          message: '支付结果确认中',
        });
      }
    }

    return buildResult(order, payment, {
      confirming: order.status === OrderStatus.pending_payment,
      displayStatus: order.status === OrderStatus.pending_payment ? 'pending' : undefined,
      canRetryPay: order.status === OrderStatus.pending_payment,
    });
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

        const processedStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed];
        if (processedStatuses.includes(currentOrder.status)) {
          if (order.couponId) {
            const coupon = await tx.userCoupon.findFirst({ where: { id: order.couponId } });
            if (coupon && coupon.status === COUPON_STATUS.LOCKED) {
              await tx.userCoupon.update({
                where: { id: order.couponId },
                data: { status: COUPON_STATUS.USED, usedAt: new Date() },
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

          const targetStatus = order.fulfillmentType === 'pickup' ? OrderStatus.pending_pickup : OrderStatus.pending_delivery;
          const updateData: any = { status: targetStatus, paidAt: new Date() };

          const updateResult = await tx.order.updateMany({
            where: { id: orderId, status: OrderStatus.pending_payment },
            data: updateData,
          });

          if (updateResult.count === 0) {
            this.logger.error(`支付半成功补偿失败: 订单${orderId}状态已变更，无法修复`);
            throw new BadRequestException('订单状态已变更，补偿失败');
          }

          if (order.fulfillmentType === 'pickup') {
            await this.orderService.assignUniquePickupCode(tx, orderId);
          }

          await tx.orderLog.create({
            data: {
              orderId,
              operatorType: 'system',
              action: 'payment_reconcile_fix',
              content: `支付半成功补偿: 支付已SUCCESS但订单仍pending_payment，已修复为${order.fulfillmentType === 'pickup' ? 'pending_pickup' : 'pending_delivery'}，交易号：${transactionId}`,
            },
          });

          if (order.couponId) {
            const coupon = await tx.userCoupon.findFirst({ where: { id: order.couponId } });
            if (coupon) {
              if (coupon.status === COUPON_STATUS.LOCKED) {
                await tx.userCoupon.update({
                  where: { id: order.couponId },
                  data: { status: COUPON_STATUS.USED, usedAt: new Date() },
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

        if (currentOrder.status === OrderStatus.cancelled) {
          this.logger.error(`支付半成功补偿时订单已取消: ${orderId}，交易号: ${transactionId}，需人工补偿`);
          this.businessEvent.emitCritical(
            'payment_half_success_on_cancelled_order',
            'payment',
            `支付半成功补偿但订单已取消: 订单${orderId}，交易号${transactionId}，需人工补偿`,
            orderId.toString(),
            { orderId: orderId.toString(), transactionId, orderStatus: currentOrder.status },
          );
          throw new BadRequestException('订单已取消，支付成功需人工补偿');
        }

        this.logger.error(`支付成功处理时订单状态异常: ${orderId}，状态: ${currentOrder.status}`);
        throw new BadRequestException('订单状态异常');
      }

      const targetStatus = order.fulfillmentType === 'pickup' ? OrderStatus.pending_pickup : OrderStatus.pending_delivery;
      const updateOrderData: any = {
        status: targetStatus,
        paidAt: new Date(),
      };

      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.pending_payment
        },
        data: updateOrderData,
      });

      if (updateResult.count === 0) {
        const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
        if (!currentOrder) {
          this.logger.error(`支付成功处理时订单不存在: ${orderId}`);
          throw new InternalServerErrorException('订单不存在');
        }

        const processedStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed];
        if (processedStatuses.includes(currentOrder.status)) {
          this.logger.log(`支付成功幂等处理: 订单${orderId}已处于${currentOrder.status}状态`);
          return;
        }

        if (currentOrder.status === OrderStatus.cancelled) {
          this.logger.error(`支付成功处理时订单已取消: ${orderId}，交易号: ${transactionId}，需人工补偿`);
          this.businessEvent.emitCritical(
            'payment_success_on_cancelled_order',
            'payment',
            `支付成功但订单已取消: 订单${orderId}，交易号${transactionId}，需人工补偿`,
            orderId.toString(),
            { orderId: orderId.toString(), transactionId, orderStatus: currentOrder.status },
          );
          throw new BadRequestException('订单已取消，支付成功需人工补偿');
        }

        this.logger.error(`支付成功处理时订单状态异常: ${orderId}，状态: ${currentOrder.status}`);
        throw new BadRequestException('订单状态异常');
      }

      if (order.fulfillmentType === 'pickup') {
        await this.orderService.assignUniquePickupCode(tx, orderId);
      }

      assertOrderTransition(OrderStatus.pending_payment, targetStatus, '支付成功');

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
              data: { status: COUPON_STATUS.USED, usedAt: new Date() },
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

    try {
      await this.shareService.processFirstPaidReward(
        order.userId.toString(),
        orderId.toString(),
        order.payAmount || 0,
      );
    } catch (err) {
      this.logger.error(`首单邀请奖励发放失败: orderId=${orderId}`, (err as Error).message);
    }
  }

  async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    const successAmount = wechatData.amount?.refund || refund.refundAmount;

    await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.orderRefund.updateMany({
        where: {
          id: refund.id,
          status: { in: [REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING, REFUND_STATUS.FAILED] },
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
              activeOrderItemId: null,
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
                data: { stock: { increment: aftersaleWithRelations.orderItem.quantity } },
              });
              await this.safeDecrementSkuSales(tx, aftersaleWithRelations.orderItem.skuId, aftersaleWithRelations.orderItem.quantity);
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
                    source: 'aftersale_refund_deduct_reward',
                    sourceId: aftersaleWithRelations.id,
                    description: `售后退款扣回${deductedPoints}积分`,
                  },
                });
              } else {
                this.businessEvent.emitWarn(
                  'aftersale_refund_deduct_points_insufficient',
                  'refund',
                  `售后退款扣回奖励积分失败：用户可用积分不足`,
                  (aftersaleWithRelations.id || '').toString(),
                  {
                    userId: aftersaleWithRelations.userId?.toString?.() || aftersaleWithRelations.userId,
                    aftersaleId: aftersaleWithRelations.id?.toString?.() || aftersaleWithRelations.id,
                    refundId: refund.id.toString(),
                    requiredDeductedPoints: deductedPoints,
                    availablePoints: user?.availablePoints ?? null,
                  },
                );
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
                    source: 'aftersale_refund_restore_deducted',
                    sourceId: aftersaleWithRelations.id,
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

  private async createWechatOrder(order: any, appId: string, mchId: string): Promise<string> {
    if (!this.privateKey) {
      throw new BadRequestException('商户私钥未配置，无法发起支付');
    }

    const notifyUrl = this.configService.get<string>('WECHAT_NOTIFY_URL')!;
    const description = order.orderItems?.[0]?.productName || `订单${order.orderNo}`;

    // 微信商户订单号必须使用业务订单号；orderPayment.paymentNo 仅作内部支付记录编号。
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
    this.ensureWechatPaymentAvailable();
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

  private verifyWechatSignature(message: string, signature: string, serialNo?: string): boolean {
    const certificate = serialNo && this.platformCertificates.has(serialNo)
      ? this.platformCertificates.get(serialNo)!
      : this.wechatpayCertificate;
    if (!certificate) {
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
      return verify.verify(certificate, signature, 'base64');
    } catch (e) {
      this.logger.error(`微信回调签名验证异常: ${(e as Error).message}`);
      return false;
    }
  }

  private async createPaymentCompensationTask(params: {
    orderNo: string;
    transactionId?: string;
    amount?: number;
    reason: string;
    callbackPayload?: any;
  }) {
    const transactionId = params.transactionId || null;
    const existingTask = await this.prisma.paymentCompensationTask.findFirst({
      where: {
        orderNo: params.orderNo,
        reason: params.reason,
        transactionId,
      },
    });
    if (existingTask) {
      return existingTask;
    }

    try {
      return await this.prisma.paymentCompensationTask.create({
        data: {
          orderNo: params.orderNo,
          transactionId,
          amount: params.amount ?? null,
          reason: params.reason,
          status: 'pending',
          callbackPayload: params.callbackPayload ?? Prisma.DbNull,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const duplicatedTask = await this.prisma.paymentCompensationTask.findFirst({
          where: {
            orderNo: params.orderNo,
            reason: params.reason,
            transactionId,
          },
        });
        if (duplicatedTask) {
          return duplicatedTask;
        }
      }
      throw error;
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
    this.ensureWechatPaymentAvailable();
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
    if (!Number.isInteger(params.refundAmount)) {
      throw new BadRequestException('退款金额必须是整数分');
    }
    if (params.refundAmount <= 0) {
      throw new BadRequestException('退款金额必须大于0分');
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
    let outRefundNo = generateRefundNo();
    let refundNo = outRefundNo;

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
    let initiatingRefund: Awaited<ReturnType<typeof this.prisma.orderRefund.create>> | null = null;
    let refundCreated = false;
    for (let refundAttempt = 0; refundAttempt < 3; refundAttempt++) {
      if (refundAttempt > 0) {
        outRefundNo = generateRefundNo();
        refundNo = outRefundNo;
      }
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
        refundCreated = true;
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          this.logger.warn(`退款单号 ${outRefundNo} 冲突，第 ${refundAttempt + 1} 次重试`);
          continue;
        }
        this.logger.error(`创建退款意图记录失败: ${outRefundNo}`, (error as Error).message);
        throw new InternalServerErrorException('退款处理失败，请稍后重试');
      }
    }
    if (!refundCreated || !initiatingRefund) {
      throw new InternalServerErrorException('退款单号生成失败，请重试');
    }

    requestBody.out_refund_no = outRefundNo;
    request.out_refund_no = outRefundNo;

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

    const timestampError = this.validateCallbackTimestamp(timestamp);
    if (timestampError) return timestampError;

    if (!rawBody) {
      this.logger.warn('微信退款回调缺少rawBody，无法验签');
      return { code: 'FAIL', message: '缺少rawBody' };
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    if (!this.verifyWechatSignature(message, signature, serialNo)) {
      this.logger.warn('微信退款回调签名验证失败');
      return { code: 'FAIL', message: '签名验证失败' };
    }

    if (serialNo && this.platformCertificates.size > 0 && !this.platformCertificates.has(serialNo)) {
      this.logger.warn(`微信退款回调证书序列号不匹配: ${serialNo}`);
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

      return { code: 'SUCCESS', message: '' };
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

    if (refund.status === REFUND_STATUS.CLOSED || refund.status === REFUND_STATUS.ABNORMAL) {
      if (refundStatus === WECHAT_REFUND_STATUS.SUCCESS) {
        this.businessEvent.emitCritical(
          'refund_terminal_status_conflict',
          'refund',
          `微信退款SUCCESS但本地已终态(${refund.status})，拒绝自动修改: ${outRefundNo}`,
          outRefundNo,
          { outRefundNo, localStatus: refund.status, wechatStatus: refundStatus, refundId },
        );
        return { code: 'FAIL', message: `退款记录已终态(${refund.status})与微信SUCCESS冲突，需人工处理` };
      }
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

      if (([REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING, REFUND_STATUS.FAILED] as string[]).includes(refund.status)) {
        if (refund.status === REFUND_STATUS.FAILED) {
          this.businessEvent.emitWarn(
            'refund_failed_to_success_recovery',
            'refund',
            `退款从failed恢复为success: ${outRefundNo}，微信侧已成功但本地曾标记失败`,
            outRefundNo,
            { outRefundNo, localStatus: refund.status, refundId: wechatResult.refund_id || refund.refundId },
          );
        }
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

      if (refund.status === REFUND_STATUS.CLOSED || refund.status === REFUND_STATUS.ABNORMAL) {
        this.businessEvent.emitCritical(
          'refund_terminal_status_conflict',
          'refund',
          `微信退款SUCCESS但本地已终态(${refund.status})，拒绝自动修改: ${outRefundNo}`,
          outRefundNo,
          { outRefundNo, localStatus: refund.status, wechatStatus },
        );
        return { synced: false, reason: 'terminal_status_conflict', message: `本地退款已终态(${refund.status})与微信SUCCESS冲突，需人工处理` };
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
    this.ensureWechatPaymentAvailable();
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

  private async safeDecrementSkuSales(tx: any, skuId: bigint, quantity: number) {
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`
        UPDATE product_skus
        SET sales = GREATEST(sales - ${quantity}, 0)
        WHERE id = ${skuId}
      `;
      return;
    }

    const sku = await tx.productSku.findFirst({ where: { id: skuId } });
    if (!sku) return;
    const nextSales = Math.max((sku.sales || 0) - quantity, 0);
    await tx.productSku.update({
      where: { id: skuId },
      data: { sales: nextSales },
    });
  }

  async getCompensationTaskList(params: { page: number; pageSize: number; status?: string; orderNo?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.orderNo) where.orderNo = { contains: params.orderNo };
    const skip = (params.page - 1) * params.pageSize;
    const [list, total] = await Promise.all([
      this.prisma.paymentCompensationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.pageSize,
      }),
      this.prisma.paymentCompensationTask.count({ where }),
    ]);
    return {
      list: list.map((item: any) => ({ ...item, id: item.id.toString() })),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  async resolveCompensationTask(id: string, handledBy: string, resolution: string, status: 'resolved' | 'ignored') {
    const validStatuses = ['resolved', 'ignored'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`非法的 status 值: ${status}，允许值: ${validStatuses.join(', ')}`);
    }
    const task = await this.prisma.paymentCompensationTask.findFirst({ where: { id: BigInt(id) } });
    if (!task) throw new NotFoundException('补偿任务不存在');
    const updated = await this.prisma.paymentCompensationTask.update({
      where: { id: BigInt(id) },
      data: {
        status,
        handledBy,
        handledAt: new Date(),
        resolution,
      },
    });
    return { ...updated, id: updated.id.toString() };
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
        order: r.order
          ? {
              ...r.order,
              id: r.order.id.toString(),
            }
          : null,
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
      order: refund.order
        ? {
            ...refund.order,
            id: refund.order.id.toString(),
            userId: refund.order.userId?.toString(),
            couponId: refund.order.couponId?.toString(),
          }
        : null,
    };
  }
}
