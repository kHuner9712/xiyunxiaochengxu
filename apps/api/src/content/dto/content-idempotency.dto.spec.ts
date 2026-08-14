import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContentDto } from './create-content.dto';
import { UpdateContentDto } from './update-content.dto';

const REQUEST_ID = '1760000000000000001';

describe('content bigint relation and create request DTO contract', () => {
  it('keeps related product ids above JavaScript safe integer precision as strings on update', async () => {
    const dto = plainToInstance(UpdateContentDto, {
      relatedProductIds: ['9007199254740993', '9223372036854775807'],
    });

    expect(dto.relatedProductIds).toEqual(['9007199254740993', '9223372036854775807']);
    await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);
  });

  it('rejects numeric related product ids instead of coercing them through JavaScript number precision', async () => {
    const dto = plainToInstance(UpdateContentDto, {
      relatedProductIds: [9007199254740991],
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toContain('relatedProductIds');
  });

  it('accepts a valid content create request id', async () => {
    const dto = plainToInstance(CreateContentDto, {
      title: '测试文章',
      contentType: 'article',
      content: '正文',
      clientRequestId: REQUEST_ID,
    });

    await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);
  });

  it('rejects create-only clientRequestId on content update in production whitelist mode', async () => {
    const dto = plainToInstance(UpdateContentDto, { clientRequestId: REQUEST_ID });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });
});
