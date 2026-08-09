import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PaymentFactDashboardService } from './payment-fact-dashboard.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [
    {
      provide: DashboardService,
      useClass: PaymentFactDashboardService,
    },
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
