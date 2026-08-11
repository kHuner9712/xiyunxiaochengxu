import { Module } from '@nestjs/common';
import { WeappUserController, AdminUserController } from './user.controller';
import { UserService } from './user.service';
import { ProductionUserService } from './production-user.service';
import { UserStatusService } from './user-status.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [PrismaModule, RedisModule, PointsModule],
  controllers: [WeappUserController, AdminUserController],
  providers: [
    { provide: UserService, useClass: ProductionUserService },
    UserStatusService,
  ],
  exports: [UserService],
})
export class UserModule {}
