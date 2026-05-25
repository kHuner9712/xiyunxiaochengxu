import { Module } from '@nestjs/common';
import { WeappContentController, WeappActivityFeedController, AdminContentController } from './content.controller';
import { ContentService } from './content.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappContentController, WeappActivityFeedController, AdminContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
