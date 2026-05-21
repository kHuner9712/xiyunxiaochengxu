import { Controller, Get, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { PointsService } from '../points/points.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('weapp/user')
export class WeappUserController {
  constructor(private readonly userService: UserService) {}

  @Get('info')
  async getUserInfo(@CurrentUser('id') userId: string) {
    return this.userService.getUserInfo(userId);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }
}

@Controller('admin/user')
export class AdminUserController {
  constructor(
    private readonly userService: UserService,
    private readonly pointsService: PointsService,
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
  async adjustLevel(
    @Param('id') id: string,
    @Body() body: { memberLevelId: number; reason?: string },
  ) {
    return this.userService.adjustLevel(id, body.memberLevelId, body.reason);
  }

  @Put('points/:id')
  @RequirePermission('user:detail')
  async adjustPoints(
    @Param('id') id: string,
    @Body() body: { points: number; reason: string },
  ) {
    return this.pointsService.adminAdjust(id, body.points, body.reason);
  }

  @Put('status/:id')
  @RequirePermission('user:detail')
  async toggleStatus(@Param('id') id: string) {
    return this.userService.toggleStatus(id);
  }
}
