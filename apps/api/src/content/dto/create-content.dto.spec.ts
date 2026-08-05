import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContentDto } from './create-content.dto';

async function validateDto(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateContentDto, input));
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
});
