import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SystemConfigService } from '../system-config/system-config.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { AttributionAwarePromotionCheckoutService } from './attribution-aware-promotion-checkout.service';
import {
  PromotionCheckoutInput,
  PromotionCheckoutResult,
} from './promotion-checkout.service';
import {
  lockActiveCheckoutUser,
  lockActivePickupStore,
  withLockedPickupStoreRead,
} from './pickup-order-guard';

@Injectable()
export class PickupSafeAttributionAwarePromotionCheckoutService
  extends AttributionAwarePromotionCheckoutService {
  constructor(@Optional() systemConfigService?: SystemConfigService) {
    super(systemConfigService);
  }

  override async createOrder(
    tx: Prisma.TransactionClient,
    input: PromotionCheckoutInput,
  ): Promise<PromotionCheckoutResult> {
    // Account cancellation locks this same user row before checking for blocking orders. A promotion
    // checkout that started with an older JWT therefore cannot create an order after cancellation
    // has committed; if checkout owns the lock first, cancellation waits and then sees the order.
    await lockActiveCheckoutUser(tx, input.userId);

    const fulfillmentType = input.fulfillmentType || 'delivery';
    if (fulfillmentType === 'pickup') {
      const pickupStoreId = parsePositiveBigIntId(String(input.pickupStoreId || ''), '自提点');
      const store = await lockActivePickupStore(tx, pickupStoreId);
      return super.createOrder(withLockedPickupStoreRead(tx, store), input);
    }
    return super.createOrder(tx, input);
  }
}
