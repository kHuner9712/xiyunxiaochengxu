import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateContentDto } from './update-content.dto';

function toDto(input: Record<string, unknown>) {
  return plainToInstance(UpdateContentDto, input);
}

async function validateDto(input: Record<string, unknown>) {
  return validate(toDto(input));
}

describe('UpdateContentDto', () => {
  it.each(['title', 'content', 'contentType'])('rejects null for non-null string field %s', async (field) => {
    const errors = await validateDto({ [field]: null });

    expect(errors.some(error => error.property === field)).toBe(true);
  });

  it.each(['isFeatured', 'sortOrder', 'status'])('rejects null for non-null numeric field %s', async (field) => {
    const errors = await validateDto({ [field]: null });

    expect(errors.some(error => error.property === field)).toBe(true);
  });

  it('allows null for fields that explicitly support clearing', async () => {
    const errors = await validateDto({
      categoryId: null,
      coverImage: null,
      summary: null,
      videoUrl: null,
      videoCover: null,
      videoDuration: null,
      placement: null,
      tags: null,
      relatedProductIds: null,
      relatedActivityId: null,
    });

    expect(errors).toHaveLength(0);
  });

  it('preserves bigint category and activity identifiers as strings', async () => {
    const dto = toDto({
      categoryId: '9007199254740993',
      relatedActivityId: '9007199254740995',
    });

    expect(dto.categoryId).toBe('9007199254740993');
    expect(dto.relatedActivityId).toBe('9007199254740995');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects identifiers longer than signed BIGINT decimal width', async () => {
    const errors = await validateDto({
      categoryId: '10000000000000000000',
      relatedActivityId: '10000000000000000000',
    });

    expect(errors.some(error => error.property === 'categoryId')).toBe(true);
    expect(errors.some(error => error.property === 'relatedActivityId')).toBe(true);
  });
});
