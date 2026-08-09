import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { parseAllowedMimeTypes } from './upload.service';

const DEFAULT_UPLOAD_MAX_SIZE = 52428800;
const USER_UPLOAD_MAX_SIZE = 10 * 1024 * 1024;
const USER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function getUploadMaxSize(): number {
  const maxFileSize = parseInt(process.env.UPLOAD_MAX_SIZE || String(DEFAULT_UPLOAD_MAX_SIZE), 10);
  return Number.isFinite(maxFileSize) && maxFileSize > 0 ? maxFileSize : DEFAULT_UPLOAD_MAX_SIZE;
}

export function createUploadMulterOptions(): MulterOptions {
  const allowedMimeTypes = parseAllowedMimeTypes();

  return {
    limits: {
      fileSize: getUploadMaxSize(),
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return callback(new BadRequestException(`不支持的MIME类型: ${file.mimetype}`), false);
      }
      callback(null, true);
    },
  };
}

export function createUserUploadMulterOptions(): MulterOptions {
  const configuredLimit = getUploadMaxSize();
  return {
    limits: {
      fileSize: Math.min(configuredLimit, USER_UPLOAD_MAX_SIZE),
    },
    fileFilter: (_req, file, callback) => {
      if (!USER_IMAGE_MIME_TYPES.has(file.mimetype)) {
        return callback(new BadRequestException('用户上传仅支持 JPG、PNG、GIF、WEBP 图片'), false);
      }
      callback(null, true);
    },
  };
}

export { USER_UPLOAD_MAX_SIZE, USER_IMAGE_MIME_TYPES };
