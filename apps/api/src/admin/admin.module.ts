import { Module } from '@nestjs/common';
import { AdminUserController, AdminRoleController, AdminPermissionController, AdminOperationLogController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminPrivilegeService } from './admin-privilege.service';
import { ProductionAdminService } from './production-admin.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminUserController, AdminRoleController, AdminPermissionController, AdminOperationLogController],
  providers: [
    AdminPrivilegeService,
    { provide: AdminService, useClass: ProductionAdminService },
  ],
  exports: [AdminService],
})
export class AdminModule {}
