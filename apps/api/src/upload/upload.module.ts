import { Module } from '@nestjs/common';
import { UploadController, AdminUploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    PrismaModule,
    MulterModule.registerAsync({
      useFactory: () => ({
        limits: {
          fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10),
        },
      }),
    }),
  ],
  controllers: [UploadController, AdminUploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
