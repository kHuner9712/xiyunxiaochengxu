import { Module } from '@nestjs/common';
import { WeappBabyProfileController, AdminBabyProfileController } from './baby-profile.controller';
import { BabyProfileService } from './baby-profile.service';
import { ProfileAssetSafeBabyProfileService } from './profile-asset-safe-baby-profile.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappBabyProfileController, AdminBabyProfileController],
  providers: [
    ProfileAssetSafeBabyProfileService,
    { provide: BabyProfileService, useExisting: ProfileAssetSafeBabyProfileService },
  ],
  exports: [BabyProfileService],
})
export class BabyProfileModule {}
