import { Module } from '@nestjs/common';
import { WeappHomeController } from './home.controller';
import { AdminBannerController } from './admin-banner.controller';
import { AdminHomeDecorController } from './admin-home-decor.controller';
import { HomeService } from './home.service';
import { ProductionHomeService } from './production-home.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [WeappHomeController, AdminBannerController, AdminHomeDecorController],
  providers: [{ provide: HomeService, useClass: ProductionHomeService }],
  exports: [HomeService],
})
export class HomeModule {}
