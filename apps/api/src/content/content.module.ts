import { Module } from '@nestjs/common';
import { WeappContentController, AdminContentController } from './content.controller';
import { ContentService } from './content.service';
import { PublicRelatedContentService } from './public-related-content.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappContentController, AdminContentController],
  providers: [
    { provide: ContentService, useClass: PublicRelatedContentService },
  ],
  exports: [ContentService],
})
export class ContentModule {}
