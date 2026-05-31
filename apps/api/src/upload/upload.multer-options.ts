import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { parseAllowedMimeTypes } from './upload.service';

const DEFAULT_UPLOAD_MAX_SIZE = 10485760;

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
