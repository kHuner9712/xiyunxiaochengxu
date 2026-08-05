import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContentDto } from './create-content.dto';

function toDto(input: Record<string, unknown>) {
  return plainToInstance(CreateContentDto, input);
}

async function validateDto(input: Record<string, unknown>) {
  return validate(toDto(input));
}

describe('CreateContentDto', () => {
  it('allows video content with an uploaded video and an empty body', async () => {
    const errors = await validateDto({
      title: '测试视频',
      contentType: 'video',
      videoUrl: 'https://api.example.com/uploads/video.mp4',
      content: '',
    });

    expect(errors).toHaveLength(0);
  });

  it('normalizes an omitted video body to empty text', async () => {
    const dto = toDto({
      title: '测试视频',
      contentType: 'video',
      videoUrl: 'https://api.example.com/uploads/video.mp4',
    });

    expect(dto.content).toBe('');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects video content without a video URL', async () => {
    const errors = await validateDto({
      title: '测试视频',
      contentType: 'video',
      content: '',
    });

    expect(errors.some((error) => error.property === 'videoUrl')).toBe(true);
  });

  it('requires a body for article content', async () => {
    const errors = await validateDto({
      title: '测试文章',
      contentType: 'article',
      content: '',
    });

    const contentError = errors.find((error) => error.property === 'content');
    expect(contentError?.constraints).toEqual(
      expect.objectContaining({ isNotEmpty: '文章类型内容必须填写正文内容' }),
    );
  });

  it('treats an omitted content type as an article', async () => {
    const errors = await validateDto({ title: '默认文章' });

    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects unsupported content types', async () => {
    const errors = await validateDto({
      title: '错误类型',
      contentType: 'audio',
      content: '正文',
    });

    expect(errors.some((error) => error.property === 'contentType')).toBe(true);
  });

  it('rejects unsupported placement values and invalid publishing states', async () => {
    const errors = await validateDto({
      title: '错误投放配置',
      contentType: 'article',
      content: '正文',
      placement: ['activity', 'unknown'],
      status: 9,
    });

    expect(errors.some((error) => error.property === 'placement')).toBe(true);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects non-positive related identifiers', async () => {
    const errors = await validateDto({
      title: '错误关联配置',
      contentType: 'article',
      content: '正文',
      relatedProductIds: [1, 0],
      relatedActivityId: 0,
    });

    expect(errors.some((error) => error.property === 'relatedProductIds')).toBe(true);
    expect(errors.some((error) => error.property === 'relatedActivityId')).toBe(true);
  });

  it('preserves category and activity IDs beyond JavaScript safe integer precision', async () => {
    const dto = toDto({
      title: '大ID内容',
      contentType: 'article',
      content: '正文',
      categoryId: '9007199254740993',
      relatedActivityId: '9007199254740995',
    });

    expect(dto.categoryId).toBe('9007199254740993');
    expect(dto.relatedActivityId).toBe('9007199254740995');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('normalizes safe numeric ID input to strings without retaining a number type', async () => {
    const dto = toDto({
      title: '数字ID输入',
      contentType: 'article',
      content: '正文',
      categoryId: 42,
      relatedActivityId: 88,
    });

    expect(dto.categoryId).toBe('42');
    expect(dto.relatedActivityId).toBe('88');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects numeric bigint IDs that have already exceeded safe integer precision', async () => {
    const unsafeNumericId = Number('9007199254740993');
    expect(Number.isSafeInteger(unsafeNumericId)).toBe(false);

    const errors = await validateDto({
      title: '危险数字ID',
      contentType: 'article',
      content: '正文',
      categoryId: unsafeNumericId,
      relatedActivityId: unsafeNumericId,
    });

    expect(errors.some((error) => error.property === 'categoryId')).toBe(true);
    expect(errors.some((error) => error.property === 'relatedActivityId')).toBe(true);
  });
});
