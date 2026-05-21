import { Module } from '@nestjs/common';
import { WeappHomeController } from './home.controller';
import { AdminBannerController } from './admin-banner.controller';
import { HomeService } from './home.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappHomeController, AdminBannerController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}
