import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type BizType = 'order' | 'payment' | 'refund' | 'coupon' | 'stock' | 'points' | 'reconcile';
export type EventLevel = 'info' | 'warn' | 'error' | 'critical';

export interface BusinessEventInput {
  eventType: string;
  bizType: BizType;
  bizId?: string;
  level?: EventLevel;
  message: string;
  payload?: any;
}

@Injectable()
export class BusinessEventService {
  private readonly logger = new Logger(BusinessEventService.name);
  private readonly webhookUrl: string | null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.webhookUrl = this.configService.get<string>('ALERT_WEBHOOK_URL', '') || null;
  }

  async emit(event: BusinessEventInput): Promise<void> {
    const level = event.level || 'info';

    try {
      await this.prisma.businessEvent.create({
        data: {
          eventType: event.eventType,
          bizType: event.bizType,
          bizId: event.bizId || null,
          level,
          message: event.message,
          payload: event.payload ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(`写入业务事件失败: ${event.eventType}`, (err as Error).message);
    }

    if (level === 'critical' && this.webhookUrl) {
      this.sendWebhook(event).catch((err) => {
        this.logger.error(`Webhook 告警发送失败: ${event.eventType}`, (err as Error).message);
      });
    }
  }

  async emitInfo(eventType: string, bizType: BizType, message: string, bizId?: string, payload?: any): Promise<void> {
    return this.emit({ eventType, bizType, bizId, level: 'info', message, payload });
  }

  async emitWarn(eventType: string, bizType: BizType, message: string, bizId?: string, payload?: any): Promise<void> {
    return this.emit({ eventType, bizType, bizId, level: 'warn', message, payload });
  }

  async emitError(eventType: string, bizType: BizType, message: string, bizId?: string, payload?: any): Promise<void> {
    return this.emit({ eventType, bizType, bizId, level: 'error', message, payload });
  }

  async emitCritical(eventType: string, bizType: BizType, message: string, bizId?: string, payload?: any): Promise<void> {
    return this.emit({ eventType, bizType, bizId, level: 'critical', message, payload });
  }

  private async sendWebhook(event: BusinessEventInput): Promise<void> {
    try {
      await axios.post(this.webhookUrl!, {
        eventType: event.eventType,
        bizType: event.bizType,
        bizId: event.bizId,
        level: event.level,
        message: event.message,
        payload: event.payload,
        timestamp: new Date().toISOString(),
      }, { timeout: 5000 });
      this.logger.log(`Webhook 告警已发送: ${event.eventType}`);
    } catch (err) {
      this.logger.error(`Webhook 告警发送失败: ${event.eventType}`, (err as Error).message);
    }
  }
}
