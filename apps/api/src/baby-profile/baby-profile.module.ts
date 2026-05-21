import { Module } from '@nestjs/common';
import { WeappBabyProfileController, AdminBabyProfileController } from './baby-profile.controller';
import { BabyProfileService } from './baby-profile.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappBabyProfileController, AdminBabyProfileController],
  providers: [BabyProfileService],
  exports: [BabyProfileService],
})
export class BabyProfileModule {}
