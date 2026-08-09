import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AttachmentSafeProductionAftersaleService } from './attachment-safe-production-aftersale.service';
import { CreateAftersaleDto } from './dto/create-aftersale.dto';
import { ProductionAftersaleService } from './production-aftersale.service';

function dto(images?: string[]): CreateAftersaleDto {
  return Object.assign(new CreateAftersaleDto(), {
    orderId: '100',
    orderItemId: '200',
    type: 1,
    reason: '商品问题',
    images,
  });
}

describe('AttachmentSafeProductionAftersaleService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('DTO only accepts up to six unique platform-private attachment URLs', async () => {
    expect(await validate(dto([
      '/api/common/file/private/1',
      '/api/common/file/private/2',
    ]))).toHaveLength(0);

    expect(await validate(dto(['https://evil.example/private/1']))).not.toHaveLength(0);
    expect(await validate(dto(['/uploads/public/avatar.jpg']))).not.toHaveLength(0);
    expect(await validate(dto(Array.from({ length: 7 }, (_, i) => `/api/common/file/private/${i + 1}`))))
      .not.toHaveLength(0);
    expect(await validate(dto([
      '/api/common/file/private/1',
      '/api/common/file/private/1',
    ]))).not.toHaveLength(0);
  });

  it('rejects external or malformed attachments before querying order data', async () => {
    const prisma: any = { fileAsset: { findMany: jest.fn() } };
    const service = new AttachmentSafeProductionAftersaleService(prisma, {} as any);
    const baseCreate = jest.spyOn(ProductionAftersaleService.prototype, 'create');

    await expect(
      service.create('10', dto(['https://evil.example/file.jpg'])),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.fileAsset.findMany).not.toHaveBeenCalled();
    expect(baseCreate).not.toHaveBeenCalled();
  });

  it('rejects a private file that is not owned by the current user or not an aftersale image', async () => {
    const prisma: any = {
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AttachmentSafeProductionAftersaleService(prisma, {} as any);
    const baseCreate = jest.spyOn(ProductionAftersaleService.prototype, 'create');

    await expect(
      service.create('10', dto(['/api/common/file/private/88'])),
    ).rejects.toThrow('售后凭证不存在、归属不符或不是有效私有图片');

    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        uploaderId: 10n,
        uploaderType: 'user',
        groupName: 'aftersale',
      }),
    }));
    expect(baseCreate).not.toHaveBeenCalled();
  });

  it('rejects assets whose storage path or media type is not a private image', async () => {
    const prisma: any = {
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 88n,
            filePath: '/uploads/public/not-private.jpg',
            fileType: 'image',
            mimeType: 'image/jpeg',
          },
        ]),
      },
    };
    const service = new AttachmentSafeProductionAftersaleService(prisma, {} as any);

    await expect(
      service.create('10', dto(['/api/common/file/private/88'])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes only validated owned aftersale attachments into the established production create flow', async () => {
    const prisma: any = {
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 88n,
            filePath: '/uploads/private/secret.jpg',
            fileType: 'image',
            mimeType: 'image/jpeg',
          },
        ]),
      },
    };
    const service = new AttachmentSafeProductionAftersaleService(prisma, {} as any);
    const baseCreate = jest
      .spyOn(ProductionAftersaleService.prototype, 'create')
      .mockResolvedValue({ id: 'aftersale-1' } as any);

    const result = await service.create('10', dto(['/api/common/file/private/88']));

    expect(result).toEqual({ id: 'aftersale-1' });
    expect(baseCreate).toHaveBeenCalledWith('10', expect.objectContaining({
      images: ['/api/common/file/private/88'],
    }));
  });
});
