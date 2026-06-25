import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AdminActivityContentController, WeappActivityContentController } from './activity-content.controller';
import { ActivityContentService } from './activity-content.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminActivityContentController, WeappActivityContentController],
  providers: [ActivityContentService],
  exports: [ActivityContentService],
})
export class ActivityContentModule {}
