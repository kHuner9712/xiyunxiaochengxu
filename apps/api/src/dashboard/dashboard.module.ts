import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { NetPaidProductDashboardService } from './net-paid-product-dashboard.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [
    {
      provide: DashboardService,
      useClass: NetPaidProductDashboardService,
    },
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
