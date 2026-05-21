import { Controller, Get, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
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
@UseGuards(RolesGuard)
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get('list')
  @Roles('admin')
  async findAll(@Query() dto: UserQueryDto) {
    return this.userService.findAll(dto);
  }

  @Get('detail/:id')
  @Roles('admin')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put('level/:id')
  @Roles('admin')
  async adjustLevel(
    @Param('id') id: string,
    @Body() body: { memberLevelId: number; reason?: string },
  ) {
    return this.userService.adjustLevel(id, body.memberLevelId, body.reason);
  }

  @Put('status/:id')
  @Roles('admin')
  async toggleStatus(@Param('id') id: string) {
    return this.userService.toggleStatus(id);
  }
}
