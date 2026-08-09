import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  createUploadMulterOptions,
  createUserUploadMulterOptions,
  USER_UPLOAD_MAX_SIZE,
} from './upload.multer-options';

describe('upload multer boundaries', () => {
  const originalMax = process.env.UPLOAD_MAX_SIZE;
  const originalTypes = process.env.UPLOAD_ALLOWED_TYPES;

  afterEach(() => {
    if (originalMax === undefined) delete process.env.UPLOAD_MAX_SIZE;
    else process.env.UPLOAD_MAX_SIZE = originalMax;
    if (originalTypes === undefined) delete process.env.UPLOAD_ALLOWED_TYPES;
    else process.env.UPLOAD_ALLOWED_TYPES = originalTypes;
  });

  it('caps common user uploads at 10MB even when the admin/global limit is larger', () => {
    process.env.UPLOAD_MAX_SIZE = String(50 * 1024 * 1024);
    expect(createUserUploadMulterOptions().limits?.fileSize).toBe(USER_UPLOAD_MAX_SIZE);
    expect(createUploadMulterOptions().limits?.fileSize).toBe(50 * 1024 * 1024);
  });

  it('respects a stricter deployment-wide limit for user uploads', () => {
    process.env.UPLOAD_MAX_SIZE = String(5 * 1024 * 1024);
    expect(createUserUploadMulterOptions().limits?.fileSize).toBe(5 * 1024 * 1024);
  });

  it('rejects videos at the common upload interceptor before buffering', () => {
    const callback = jest.fn();
    const options = createUserUploadMulterOptions();
    options.fileFilter?.(
      {} as any,
      { mimetype: 'video/mp4' } as Express.Multer.File,
      callback as any,
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
    expect(callback.mock.calls[0][1]).toBe(false);
  });

  it('allows supported avatar/aftersale image MIME types at the common interceptor', () => {
    const callback = jest.fn();
    const options = createUserUploadMulterOptions();
    options.fileFilter?.(
      {} as any,
      { mimetype: 'image/jpeg' } as Express.Multer.File,
      callback as any,
    );
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
