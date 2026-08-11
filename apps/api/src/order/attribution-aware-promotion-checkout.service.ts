import { Injectable, Optional } from '@nestjs/common';
import { SystemConfigService } from '../system-config/system-config.service';
import {
  PromotionCheckoutInput,
  PromotionCheckoutResult,
  PromotionCheckoutService,
} from './promotion-checkout.service';
import { Prisma } from '@prisma/client';
import {
  resolveCreateOrderAttribution,
  type MerchantPromotionSourceLookup,
} from './order-attribution';

@Injectable()
export class AttributionAwarePromotionCheckoutService extends PromotionCheckoutService {
  constructor(@Optional() systemConfigService?: SystemConfigService) {
    super(systemConfigService);
  }

  override async createOrder(
    tx: Prisma.TransactionClient,
    input: PromotionCheckoutInput,
  ): Promise<PromotionCheckoutResult> {
    let enriched = await resolveCreateOrderAttribution(
      tx as unknown as MerchantPromotionSourceLookup,
      input,
    );
    const shouldRecoverAttribution =
      enriched.sourceType === 'user_referral' ||
      enriched.sourceType === 'campaign' ||
      !!enriched.referrerUserId ||
      !!enriched.shareRecordId ||
      !!enriched.shareCampaignId;

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
          ...enriched,
          referrerUserId: enriched.referrerUserId || relation.inviterUserId.toString(),
          shareRecordId: enriched.shareRecordId || relation.sourceShareRecordId?.toString(),
          shareCampaignId: enriched.shareCampaignId || relation.sourceCampaignId?.toString(),
        };
      }
    }

    return super.createOrder(tx, enriched);
  }
}
