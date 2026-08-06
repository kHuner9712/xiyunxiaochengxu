import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessEventService } from './business-event.service';
import { BusinessEventController } from './business-event.controller';
import { PrismaModule } from './prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [BusinessEventController],
  providers: [BusinessEventService],
  exports: [BusinessEventService],
})
export class BusinessEventModule {}
