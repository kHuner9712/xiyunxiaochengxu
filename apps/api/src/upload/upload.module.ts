import { Module } from '@nestjs/common';
import { UploadController, AdminUploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UploadController, AdminUploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
