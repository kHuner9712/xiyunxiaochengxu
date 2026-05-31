import { Module } from '@nestjs/common';
import { UploadController, AdminUploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { createUploadMulterOptions } from './upload.multer-options';

@Module({
  imports: [
    PrismaModule,
    MulterModule.registerAsync({
      useFactory: createUploadMulterOptions,
    }),
  ],
  controllers: [UploadController, AdminUploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
