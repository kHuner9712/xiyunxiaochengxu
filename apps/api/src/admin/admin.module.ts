import { Module } from '@nestjs/common';
import { AdminUserController, AdminRoleController, AdminPermissionController, AdminOperationLogController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminUserController, AdminRoleController, AdminPermissionController, AdminOperationLogController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
