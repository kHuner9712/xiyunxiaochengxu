import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GroupBuyService } from './group-buy.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  GroupBuyActivityQueryDto,
  GroupBuyActivityDto,
  GroupBuyActivityStatusDto,
  GroupBuyGroupQueryDto,
  GroupBuyMemberQueryDto,
  StartGroupBuyDto,
  JoinGroupBuyDto,
  AvailableGroupQueryDto,
} from './dto/group-buy.dto';

// ============ 后台 ============

@Controller('admin/group-buy')
export class AdminGroupBuyController {
  constructor(private readonly service: GroupBuyService) {}

  // ===== 活动管理 =====
  @Get('activity/list')
  @RequirePermission('marketing:activity')
  async activityList(@Query() dto: GroupBuyActivityQueryDto) {
    return this.service.findActivities(dto);
  }

  @Get('activity/detail/:id')
  @RequirePermission('marketing:activity')
  async activityDetail(@Param('id') id: string) {
    return this.service.findActivityById(id);
  }

  @Post('activity/create')
  @RequirePermission('marketing:activity')
  async activityCreate(@Body() dto: GroupBuyActivityDto) {
    return this.service.createActivity(dto);
  }

  @Put('activity/update/:id')
  @RequirePermission('marketing:activity')
  async activityUpdate(@Param('id') id: string, @Body() dto: GroupBuyActivityDto) {
    return this.service.updateActivity(id, dto);
  }

  @Put('activity/status/:id')
  @RequirePermission('marketing:activity')
  async activityStatus(@Param('id') id: string, @Body() dto: GroupBuyActivityStatusDto) {
    return this.service.updateActivityStatus(id, dto);
  }

  @Delete('activity/delete/:id')
  @RequirePermission('marketing:activity')
  async activityDelete(@Param('id') id: string) {
    return this.service.deleteActivity(id);
  }

  // ===== 团单查询 =====
  @Get('groups')
  @RequirePermission('marketing:activity')
  async groups(@Query() dto: GroupBuyGroupQueryDto) {
    return this.service.findGroups(dto);
  }

  @Get('groups/:id')
  @RequirePermission('marketing:activity')
  async groupDetail(@Param('id') id: string) {
    return this.service.findGroupById(id);
  }

  @Get('members')
  @RequirePermission('marketing:activity')
  async members(@Query() dto: GroupBuyMemberQueryDto) {
    return this.service.findMembers(dto);
  }

  @Get('stats')
  @RequirePermission('marketing:activity')
  async stats() {
    return this.service.getStats();
  }

  // ===== 手动标记过期团 =====
  @Post('groups/mark-expired')
  @RequirePermission('marketing:activity')
  async markExpired() {
    return this.service.markExpiredGroups();
  }
}

// ============ 小程序 ============

@Controller('weapp/group-buy')
export class WeappGroupBuyController {
  constructor(private readonly service: GroupBuyService) {}

  @Public()
  @Get('list')
  async list(@Query() query: { page?: string; pageSize?: string }) {
    return this.service.weappFindActivities({
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 10,
    });
  }

  @Public()
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.service.weappFindActivityById(id);
  }

  @Public()
  @Get('available-groups')
  async availableGroups(@Query() dto: AvailableGroupQueryDto) {
    return this.service.weappFindAvailableGroups(String(dto.activityId));
  }

  @Get('my-groups')
  async myGroups(
    @CurrentUser('id') userId: string,
    @Query() query: { page?: string; pageSize?: string },
  ) {
    return this.service.weappFindMyGroups(userId, {
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 10,
    });
  }

  @Public()
  @Get('group/:id')
  async groupDetail(@Param('id') id: string) {
    return this.service.weappFindGroupById(id);
  }

  @Post('start')
  async start(@CurrentUser('id') userId: string, @Body() dto: StartGroupBuyDto) {
    return this.service.startGroupBuy(userId, dto);
  }

  @Post('join')
  async join(@CurrentUser('id') userId: string, @Body() dto: JoinGroupBuyDto) {
    return this.service.joinGroupBuy(userId, dto);
  }
}
