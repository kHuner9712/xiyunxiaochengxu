import { Module } from '@nestjs/common';
import { WeappActivityController, AdminActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappActivityController, AdminActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
