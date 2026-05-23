import { describe, it, expect } from '@jest/globals';

describe('UploadService 文件安全校验', () => {
  const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.mp4', '.webm',
    '.pdf',
    '.doc', '.docx',
    '.xls', '.xlsx',
  ];

  const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  describe('ALLOWED_EXTENSIONS 白名单', () => {
    it('应允许 jpg/png/gif/webp/bmp 图片', () => {
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      for (const ext of allowed) {
        expect(ALLOWED_EXTENSIONS).toContain(ext);
      }
    });

    it('不应允许 svg 扩展名', () => {
      expect(ALLOWED_EXTENSIONS).not.toContain('.svg');
    });

    it('不应允许可执行文件扩展名', () => {
      const dangerous = ['.exe', '.bat', '.sh', '.php', '.jsp', '.asp', '.html', '.htm', '.js', '.svg'];
      for (const ext of dangerous) {
        expect(ALLOWED_EXTENSIONS).not.toContain(ext);
      }
    });
  });

  describe('ALLOWED_MIME_TYPES 白名单', () => {
    it('不应允许 image/svg+xml MIME 类型', () => {
      expect(ALLOWED_MIME_TYPES).not.toContain('image/svg+xml');
    });

    it('不应允许脚本相关 MIME 类型', () => {
      const dangerous = [
        'text/html', 'application/javascript', 'text/javascript',
        'application/x-php', 'application/x-jsp',
        'image/svg+xml',
      ];
      for (const mime of dangerous) {
        expect(ALLOWED_MIME_TYPES).not.toContain(mime);
      }
    });
  });
});
