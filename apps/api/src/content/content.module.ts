import { Module } from '@nestjs/common';
import { WeappContentController, AdminContentController } from './content.controller';
import { ContentService } from './content.service';
import { DurableContentMutationService } from './durable-content-mutation.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappContentController, AdminContentController],
  providers: [
    { provide: ContentService, useClass: DurableContentMutationService },
  ],
  exports: [ContentService],
})
export class ContentModule {}
