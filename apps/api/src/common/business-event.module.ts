import { Global, Module } from '@nestjs/common';
import { BusinessEventService } from './business-event.service';
import { BusinessEventController } from './business-event.controller';
import { PrismaModule } from './prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [BusinessEventController],
  providers: [BusinessEventService],
  exports: [BusinessEventService],
})
export class BusinessEventModule {}
