import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { SnapshotViewBenefitPackageService } from './snapshot-view-benefit-package.service';

@Injectable()
export class ValiditySafeSnapshotViewBenefitPackageService extends SnapshotViewBenefitPackageService {
  constructor(
    prisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(prisma, merchantSettlementService);
  }

  override async previewVerify(verifyCode: string) {
    const preview: any = await super.previewVerify(verifyCode);
    const validFrom = preview?.validFrom ? new Date(preview.validFrom) : null;
    if (
      preview?.canVerify === true &&
      validFrom &&
      Number.isFinite(validFrom.getTime()) &&
      validFrom.getTime() > Date.now()
    ) {
      return {
        ...preview,
        canVerify: false,
        reason: '权益尚未生效',
      };
    }
    return preview;
  }

  override async verify(verifyCode: string, adminId: string, remark?: string) {
    const preview: any = await super.previewVerify(verifyCode);
    const validFrom = preview?.validFrom ? new Date(preview.validFrom) : null;
    if (
      validFrom &&
      Number.isFinite(validFrom.getTime()) &&
      validFrom.getTime() > Date.now()
    ) {
      throw new BadRequestException('权益尚未生效，不可核销');
    }
    return super.verify(verifyCode, adminId, remark);
  }
}
