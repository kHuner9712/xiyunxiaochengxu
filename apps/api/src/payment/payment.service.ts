import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { assertOrderTransition } from '../order/order-state-machine';
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
      return { code: 'FAIL', message: '订单不存在' };
    }

    if (order.status !== OrderStatus.pending_payment) {
      this.logger.log(`微信回调订单已处理: ${outTradeNo}，状态: ${order.status}`);
      return { code: 'SUCCESS', message: '' };
    }

    if (totalAmount !== order.payAmount) {
      this.logger.warn(`微信回调金额不匹配: ${totalAmount} vs ${order.payAmount}，订单号: ${outTradeNo}`);
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

  private async processPaymentSuccess(paymentId: bigint, orderId: bigint, transactionId: string, totalAmount: number | null | undefined, order: any) {
    await this.prisma.$transaction(async (tx) => {
      assertOrderTransition(OrderStatus.pending_payment, OrderStatus.pending_delivery, '支付成功');

      await tx.orderPayment.update({
        where: { id: paymentId },
        data: {
          transactionId,
          status: 2,
          paidAt: new Date(),
          rawResponse: { totalAmount, transactionId },
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.pending_delivery,
          paidAt: new Date(),
          orderLogs: {
            create: {
              operatorType: 'system',
              action: 'pay',
              content: `微信支付成功，交易号：${transactionId}`,
            },
          },
        },
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

  private async queryWechatOrder(outTradeNo: string): Promise<any> {
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
    if (!order.payment || order.payment.status !== 2) {
      throw new BadRequestException('订单未支付成功');
    }
    if (params.refundAmount > order.payAmount!) {
      throw new BadRequestException('退款金额不能超过订单实付金额');
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
        this.logger.error('微信退款请求失败', (error as any).response?.data || (error as Error).message);
      }
    }

    const refund = await this.prisma.orderRefund.create({
      data: {
        refundNo,
        orderId: BigInt(params.orderId),
        aftersaleId: params.aftersaleId ? BigInt(params.aftersaleId) : null,
        paymentId: order.payment.id,
        outTradeNo: order.orderNo,
        transactionId: order.payment.transactionId,
        outRefundNo,
        refundId: response?.data?.refund_id || null,
        refundAmount: params.refundAmount,
        totalAmount: order.payAmount!,
        status: 'pending',
        reason: params.reason,
        rawRequest: request,
        rawResponse: response?.data || null,
      },
    });

    this.logger.log(`创建退款成功: ${refundNo}, 订单: ${order.orderNo}`);

    return { refundId: refund.id.toString(), refundNo, outRefundNo };
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

    const refund = await this.prisma.orderRefund.findFirst({
      where: { outRefundNo },
    });

    if (!refund) {
      this.logger.warn(`微信退款回调退款记录不存在: ${outRefundNo}`);
      return { code: 'SUCCESS', message: '' };
    }

    if (refund.status === 'success') {
      this.logger.log(`微信退款回调已处理成功，跳过: ${outRefundNo}`);
      return { code: 'SUCCESS', message: '' };
    }

    await this.prisma.$transaction(async (tx) => {
      if (refundStatus === 'SUCCESS') {
        await tx.orderRefund.update({
          where: { id: refund.id },
          data: {
            status: 'success',
            refundId: refundId,
            notifiedAt: new Date(),
            rawResponse: decryptedData,
          },
        });

        if (refund.aftersaleId) {
          const aftersale = await tx.aftersaleOrder.findFirst({
            where: { id: refund.aftersaleId },
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

            if (aftersale.type === 2 && aftersale.orderItem) {
              const sku = await tx.productSku.findFirst({ where: { id: aftersale.orderItem.skuId } });
              if (sku) {
                await tx.productSku.update({
                  where: { id: aftersale.orderItem.skuId },
                  data: { stock: { increment: aftersale.orderItem.quantity }, sales: { decrement: aftersale.orderItem.quantity } },
                });
                await tx.productStockLog.create({
                  data: {
                    productId: aftersale.orderItem.productId,
                    skuId: aftersale.orderItem.skuId,
                    type: 4,
                    quantity: aftersale.orderItem.quantity,
                    beforeStock: sku.stock,
                    afterStock: sku.stock + aftersale.orderItem.quantity,
                    reason: '售后退款归还库存',
                  },
                });
              }
            }

            if (aftersale.refundAmount && aftersale.refundAmount > 0 && aftersale.order.payAmount) {
              const deductedPoints = Math.floor(aftersale.refundAmount / 100);
              if (deductedPoints > 0) {
                const user = await tx.user.findFirst({ where: { id: aftersale.userId } });
                if (user && user.availablePoints >= deductedPoints) {
                  await tx.user.update({
                    where: { id: aftersale.userId },
                    data: {
                      availablePoints: { decrement: deductedPoints },
                    },
                  });
                  await tx.pointsRecord.create({
                    data: {
                      userId: aftersale.userId,
                      type: 2,
                      points: deductedPoints,
                      balance: user.availablePoints - deductedPoints,
                      source: 'aftersale_refund',
                      sourceId: aftersale.orderId,
                      description: `售后退款扣回${deductedPoints}积分`,
                    },
                  });
                }
              }
            }

            if (aftersale.order.pointsDeducted > 0 && aftersale.refundAmount && aftersale.order.payAmount) {
              const restorePoints = Math.floor(aftersale.order.pointsDeducted * aftersale.refundAmount / aftersale.order.payAmount);
              if (restorePoints > 0) {
                const user = await tx.user.findFirst({ where: { id: aftersale.userId } });
                if (user) {
                  await tx.user.update({
                    where: { id: aftersale.userId },
                    data: {
                      availablePoints: { increment: restorePoints },
                    },
                  });
                  await tx.pointsRecord.create({
                    data: {
                      userId: aftersale.userId,
                      type: 1,
                      points: restorePoints,
                      balance: user.availablePoints + restorePoints,
                      source: 'aftersale_refund_restore',
                      sourceId: aftersale.orderId,
                      description: `售后退款归还抵扣积分${restorePoints}`,
                    },
                  });
                }
              }
            }

            const otherAftersales = await tx.aftersaleOrder.findFirst({
              where: {
                orderId: aftersale.orderId,
                id: { not: aftersale.id },
                status: { notIn: ['closed', 'rejected', 'refunded'] },
              },
            });
            if (!otherAftersales) {
              const restoreStatus = aftersale.order.completedAt ? 'completed' : 'delivered';
              await tx.order.update({
                where: { id: aftersale.orderId },
                data: { status: restoreStatus },
              });
            }
          }
        }
      } else if (refundStatus === 'CLOSED' || refundStatus === 'ABNORMAL') {
        await tx.orderRefund.update({
          where: { id: refund.id },
          data: {
            status: 'failed',
            notifiedAt: new Date(),
            rawResponse: decryptedData,
          },
        });

        if (refund.aftersaleId) {
          await tx.aftersaleOrder.update({
            where: { id: refund.aftersaleId },
            data: {
              status: 'closed',
              aftersaleLogs: {
                create: {
                  operatorType: 'system',
                  action: 'refund_failed',
                  content: `微信退款失败，状态: ${refundStatus}`,
                },
              },
            },
          });
        }
      }
    });

    this.logger.log(`微信退款回调处理成功: ${outRefundNo}, 状态: ${refundStatus}`);
    return { code: 'SUCCESS', message: '' };
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
}
