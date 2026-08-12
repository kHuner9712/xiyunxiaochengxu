import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { ProductionUserService } from './production-user.service';
import { UserStatusService } from './user-status.service';
import { AdminPointsAdjustmentService } from '../points/admin-points-adjustment.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  AdjustMemberLevelDto,
  AdjustUserPointsDto,
  UpdateUserStatusDto,
} from './dto/admin-user-mutation.dto';

@Controller('weapp/user')
export class WeappUserController {
  constructor(private readonly userService: ProductionUserService) {}

  @Get('info')
  async getUserInfo(@CurrentUser('id') userId: string) {
    return this.userService.getUserInfo(userId);
  }

  @Put('profile')
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Delete('account')
  async cancelAccount(@CurrentUser('id') userId: string) {
    return this.userService.cancelAccount(userId);
  }
}

@Controller('admin/user')
export class AdminUserController {
  constructor(
    private readonly userService: UserService,
    private readonly adminPointsAdjustmentService: AdminPointsAdjustmentService,
    private readonly userStatusService: UserStatusService,
  ) {}

  @Get('list')
  @RequirePermission('user:list')
  async findAll(@Query() dto: UserQueryDto) {
    return this.userService.findAll(dto);
  }

  @Get('detail/:id')
  @RequirePermission('user:detail')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put('level/:id')
  @RequirePermission('user:member')
  async adjustLevel(@Param('id') id: string, @Body() body: AdjustMemberLevelDto) {
    return this.userService.adjustLevel(id, body.memberLevelId, body.reason);
  }

  @Put('points/:id')
  @RequirePermission('user:points')
  async adjustPoints(@Param('id') id: string, @Body() body: AdjustUserPointsDto) {
    return this.adminPointsAdjustmentService.adjust(
      id,
      body.points,
      body.reason,
      body.expectedAvailablePoints,
    );
  }

  @Put('status/:id')
  @RequirePermission('user:detail')
  async setStatus(@Param('id') id: string, @Body() body: UpdateUserStatusDto) {
    return this.userStatusService.setStatus(id, body.status);
  }
}
