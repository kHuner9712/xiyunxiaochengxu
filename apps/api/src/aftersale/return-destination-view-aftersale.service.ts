import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { AttachmentSafeProductionAftersaleService } from './attachment-safe-production-aftersale.service';
import {
  RETURN_DESTINATION_ACTION,
  type ReturnDestinationSnapshot,
} from './return-destination';

@Injectable()
export class ReturnDestinationViewAftersaleService extends AttachmentSafeProductionAftersaleService {
  constructor(
    prisma: PrismaService,
    paymentService: PaymentService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(prisma, paymentService, systemConfigService);
  }

  override async findUserDetail(userId: string, id: string) {
    return this.withReturnDestination(await super.findUserDetail(userId, id));
  }

  override async findAdminDetail(id: string) {
    return this.withReturnDestination(await super.findAdminDetail(id));
  }

  private withReturnDestination(detail: any) {
    const snapshot = this.readSnapshot(detail?.aftersaleLogs);
    return {
      ...detail,
      returnReceiverName: snapshot?.receiverName ?? null,
      returnReceiverPhone: snapshot?.receiverPhone ?? null,
      returnAddress: snapshot?.address ?? null,
      aftersaleLogs: Array.isArray(detail?.aftersaleLogs)
        ? detail.aftersaleLogs.map((log: any) => {
            if (log?.action !== RETURN_DESTINATION_ACTION) return log;
            return {
              ...log,
              content: snapshot
                ? `退货收件信息：${snapshot.receiverName}，${snapshot.receiverPhone}，${snapshot.address}`
                : '退货收件信息已记录',
            };
          })
        : detail?.aftersaleLogs,
    };
  }

  private readSnapshot(logs: any): ReturnDestinationSnapshot | null {
    if (!Array.isArray(logs)) return null;
    const log = logs.find((item: any) => item?.action === RETURN_DESTINATION_ACTION && item?.content);
    if (!log) return null;
    try {
      const parsed = JSON.parse(String(log.content));
      if (
        parsed?.version === 1
        && typeof parsed.receiverName === 'string'
        && typeof parsed.receiverPhone === 'string'
        && typeof parsed.address === 'string'
      ) {
        return parsed as ReturnDestinationSnapshot;
      }
    } catch {
      return null;
    }
    return null;
  }
}
