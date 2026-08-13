import { Module } from '@nestjs/common';
import { UploadController, AdminUploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { ProfileSafeUploadService } from './profile-safe-upload.service';
import { DirectProfileAccountCleanupService } from './direct-profile-account-cleanup.service';
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
  providers: [
    {
      provide: UploadService,
      useClass: ProfileSafeUploadService,
    },
    DirectProfileAccountCleanupService,
  ],
  exports: [UploadService, DirectProfileAccountCleanupService],
})
export class UploadModule {}
