import { Module } from '@nestjs/common';
import { UploadController, AdminUploadController } from './upload.controller';
import { UploadService, parseAllowedMimeTypes, getAllowedExtensions } from './upload.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import * as path from 'path';

@Module({
  imports: [
    PrismaModule,
    MulterModule.registerAsync({
      useFactory: () => {
        const allowedMimeTypes = parseAllowedMimeTypes();
        const allowedExtensions = getAllowedExtensions(allowedMimeTypes);

        return {
          limits: {
            fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10),
          },
          fileFilter: (_req: any, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
            const ext = path.extname(file.originalname).toLowerCase();
            if (!allowedMimeTypes.includes(file.mimetype)) {
              return callback(new Error(`不支持的MIME类型: ${file.mimetype}`), false);
            }
            if (!allowedExtensions.includes(ext)) {
              return callback(new Error(`不支持的文件类型: ${ext}，仅允许: ${allowedExtensions.join(', ')}`), false);
            }
            callback(null, true);
          },
        };
      },
    }),
  ],
  controllers: [UploadController, AdminUploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
