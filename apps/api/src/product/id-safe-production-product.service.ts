import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ProductionProductService } from './production-product.service';

@Injectable()
export class IdSafeProductionProductService extends ProductionProductService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  override async findById(id: string) {
    const productId = parsePositiveBigIntId(id, '商品');
    return super.findById(productId.toString());
  }

  override async findAdminById(id: string) {
    const productId = parsePositiveBigIntId(id, '商品');
    return super.findAdminById(productId.toString());
  }

  override async delete(id: string) {
    const productId = parsePositiveBigIntId(id, '商品');
    return super.delete(productId.toString());
  }

  override async updateStatus(id: string, status: number) {
    const productId = parsePositiveBigIntId(id, '商品');
    return super.updateStatus(productId.toString(), status);
  }
}
