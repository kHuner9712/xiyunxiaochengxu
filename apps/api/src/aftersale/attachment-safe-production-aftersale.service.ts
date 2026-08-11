import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PaymentService } from '../payment/payment.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateAftersaleDto } from './dto/create-aftersale.dto';
import { ProductionAftersaleService } from './production-aftersale.service';

const PRIVATE_AFTERSALE_URL = /^\/api\/common\/file\/private\/([1-9]\d*)$/;

@Injectable()
export class AttachmentSafeProductionAftersaleService extends ProductionAftersaleService {
  constructor(
    private readonly attachmentPrisma: PrismaService,
    paymentService: PaymentService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(attachmentPrisma, paymentService, systemConfigService);
  }

  override async create(userId: string, dto: CreateAftersaleDto) {
    const images = await this.validateOwnedAftersaleImages(userId, dto.images);
    return super.create(userId, {
      ...dto,
      images,
    });
  }

  override async findByUser(
    userId: string,
    dto: { skip?: number; take?: number; page?: number; pageSize?: number },
  ) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const where = { userId: userIdValue };
    const [records, total] = await Promise.all([
      this.attachmentPrisma.aftersaleOrder.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNo: true } },
          orderItem: {
            select: {
              productName: true,
              productImage: true,
            },
          },
        },
      }),
      this.attachmentPrisma.aftersaleOrder.count({ where }),
    ]);

    const list = records.map((record) => ({
      id: record.id.toString(),
      orderNo: record.order?.orderNo || '',
      type: record.type,
      reason: record.reason,
      status: record.status,
      refundAmount: record.refundAmount ?? 0,
      productName: record.orderItem?.productName || '',
      productImage: record.orderItem?.productImage || '',
      createTime: record.createdAt,
    }));

    return paginate(list, total, dto.page ?? 1, dto.pageSize ?? 10);
  }

  private async validateOwnedAftersaleImages(userId: string, images?: string[]) {
    if (!images?.length) return undefined;
    if (images.length > 6) throw new BadRequestException('售后凭证最多上传6张');

    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const ids: bigint[] = [];
    const normalizedUrls: string[] = [];
    const seen = new Set<string>();

    for (const raw of images) {
      const value = String(raw ?? '').trim();
      const match = PRIVATE_AFTERSALE_URL.exec(value);
      if (!match) {
        throw new BadRequestException('售后凭证必须使用本平台私有上传文件');
      }
      if (seen.has(value)) throw new BadRequestException('售后凭证不能重复');
      seen.add(value);
      ids.push(parsePositiveBigIntId(match[1], '售后凭证文件'));
      normalizedUrls.push(value);
    }

    const files = await this.attachmentPrisma.fileAsset.findMany({
      where: {
        id: { in: ids },
        uploaderId: userIdValue,
        uploaderType: 'user',
        groupName: 'aftersale',
      },
      select: {
        id: true,
        filePath: true,
        fileType: true,
        mimeType: true,
      },
    });
    const validIds = new Set(
      files
        .filter((file) => {
          const filePath = String(file.filePath ?? '').replace(/\\/g, '/');
          return filePath.startsWith('/uploads/private/')
            && file.fileType === 'image'
            && String(file.mimeType ?? '').startsWith('image/');
        })
        .map((file) => file.id.toString()),
    );

    if (validIds.size !== ids.length || ids.some((id) => !validIds.has(id.toString()))) {
      throw new BadRequestException('售后凭证不存在、归属不符或不是有效私有图片');
    }

    return normalizedUrls;
  }
}