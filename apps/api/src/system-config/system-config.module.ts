import { Module } from '@nestjs/common';
import { SystemConfigController, WeappCustomerServiceController, AdminCustomerServiceController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SystemConfigController, WeappCustomerServiceController, AdminCustomerServiceController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
