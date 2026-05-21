import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { AdminQueryDto } from './dto/admin-query.dto';
import { OperationLogQueryDto } from './dto/operation-log-query.dto';

@Controller('admin/admin-user')
export class AdminUserController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query() dto: AdminQueryDto) {
    return this.adminService.findAll(dto);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.adminService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateAdminUserDto) {
    return this.adminService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateAdminUserDto>) {
    return this.adminService.update(id, dto);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: number }) {
    return this.adminService.updateStatus(id, body.status);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.adminService.delete(id);
  }
}

@Controller('admin/role')
export class AdminRoleController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list() {
    return this.adminService.findAllRoles();
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.adminService.findRoleById(id);
  }

  @Post()
  async create(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.adminService.updateRole(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }
}

@Controller('admin/permission')
export class AdminPermissionController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tree')
  async tree() {
    return this.adminService.findAllPermissions();
  }
}

@Controller('admin/operation-log')
export class AdminOperationLogController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query() dto: OperationLogQueryDto) {
    return this.adminService.findOperationLogs(dto);
  }
}
