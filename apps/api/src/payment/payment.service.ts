import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
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

    if (nodeEnv === 'production' && !this.wechatpayCertificate) {
      throw new Error('生产环境必须配置微信支付平台证书(WECHAT_PLATFORM_CERT_PATH)，支付模块不可启动');
    }
    if (nodeEnv !== 'production' && skipVerify !== 'true' && !this.wechatpayCertificate) {
      this.logger.warn('微信平台证书未配置，非生产环境允许跳过验签(设置WECHAT_SKIP_VERIFY=true)');
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
}
