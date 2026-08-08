import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import {
  PromotionCheckoutInput,
  PromotionCheckoutResult,
  PromotionCheckoutService,
} from './promotion-checkout.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttributionAwarePromotionCheckoutService extends PromotionCheckoutService {
  constructor(
    private readonly attributionPrisma: PrismaService,
    systemConfigService: SystemConfigService,
  ) {
    super(systemConfigService);
  }

  override async createOrder(
    tx: Prisma.TransactionClient,
    input: PromotionCheckoutInput,
  ): Promise<PromotionCheckoutResult> {
    let enriched = input;
    const shouldRecoverAttribution =
      input.sourceType === 'user_referral' ||
      input.sourceType === 'campaign' ||
      !!input.referrerUserId ||
      !!input.shareRecordId ||
      !!input.shareCampaignId;

    if (shouldRecoverAttribution) {
      const relation = await tx.userInviteRelation.findFirst({
        where: {
          inviteeUserId: input.userId,
          status: 1,
        },
        select: {
          inviterUserId: true,
          sourceShareRecordId: true,
          sourceCampaignId: true,
        },
      });

      if (relation) {
        enriched = {
          ...input,
          referrerUserId: input.referrerUserId || relation.inviterUserId.toString(),
          shareRecordId: input.shareRecordId || relation.sourceShareRecordId?.toString(),
          shareCampaignId: input.shareCampaignId || relation.sourceCampaignId?.toString(),
        };
      }
    }

    return super.createOrder(tx, enriched);
  }
}
