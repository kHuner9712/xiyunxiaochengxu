import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateMerchantPromotionSourceDto } from './dto/merchant-promotion-source.dto';
import { MerchantPromotionSourceService } from './merchant-promotion-source.service';

/**
 * A promotion code is persisted on orders as their historical attribution identity.
 * Changing the code after creation would orphan those order snapshots from statistics and
 * delayed sales-commission settlement, so the identity itself is immutable. Operational fields
 * such as name, contacts, scene and enabled status remain editable through the base service.
 */
@Injectable()
export class IdentitySafeMerchantPromotionSourceService extends MerchantPromotionSourceService {
  constructor(private readonly identityPrisma: PrismaService) {
    super(identityPrisma);
  }

  override async update(id: string, dto: UpdateMerchantPromotionSourceDto) {
    if (dto.promotionCode !== undefined) {
      const source = await this.identityPrisma.merchantPromotionSource.findFirst({
        where: { id: BigInt(id), deletedAt: null },
        select: { promotionCode: true },
      });
      if (!source) throw new NotFoundException('商家推广码不存在');

      const requestedCode = dto.promotionCode.trim().toUpperCase();
      if (requestedCode !== source.promotionCode) {
        throw new BadRequestException(
          '推广码是订单归因身份，创建后不可修改；如需新推广码，请新建商家推广来源',
        );
      }
    }

    return super.update(id, dto);
  }
}
