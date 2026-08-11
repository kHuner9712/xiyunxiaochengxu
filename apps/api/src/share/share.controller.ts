import { Controller, Post, Get, Put, Body, Query, Param } from '@nestjs/common';
import { ShareService } from './share.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  BindInviteDto,
  CreateCampaignDto,
  PaginationQueryDto,
  PosterQueryDto,
  RewardQueryDto,
  ShareRecordDto,
  ShareVisitDto,
  UpdateCampaignDto,
  UpdateCampaignStatusDto,
} from './dto/share.dto';

@Controller('weapp/share')
export class WeappShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post('record')
  async record(
    @CurrentUser('id') userId: string,
    @Body() dto: ShareRecordDto,
  ) {
    return this.shareService.recordShare(userId, dto);
  }

  @Public()
  @Post('visit')
  async visit(@Body() dto: ShareVisitDto) {
    return this.shareService.recordVisit(dto);
  }

  @Post('bind-invite')
  async bindInvite(
    @CurrentUser('id') userId: string,
    @Body() dto: BindInviteDto,
  ) {
    return this.shareService.bindInvite(userId, dto);
  }

  @Get('poster')
  async getPoster(
    @CurrentUser('id') userId: string,
    @Query() query: PosterQueryDto,
  ) {
    return this.shareService.getPoster(userId, query.type, query.targetId);
  }

  @Get('my-stats')
  async getMyStats(@CurrentUser('id') userId: string) {
    return this.shareService.getMyStats(userId);
  }

  @Get('my-rewards')
  async getMyRewards(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.shareService.getMyRewards(userId, query.page, query.pageSize);
  }
}

@Controller('admin/share')
export class AdminShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('campaign/list')
  @RequirePermission('share:campaign')
  async listCampaigns(@Query() query: PaginationQueryDto) {
    return this.shareService.findAllCampaigns(query.page, query.pageSize);
  }

  @Post('campaign')
  @RequirePermission('share:campaign')
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.shareService.createCampaign(dto);
  }

  @Put('campaign/:id')
  @RequirePermission('share:campaign')
  async updateCampaign(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.shareService.updateCampaign(id, dto);
  }

  @Put('campaign/:id/status')
  @RequirePermission('share:campaign')
  async updateCampaignStatus(@Param('id') id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.shareService.updateCampaignStatus(id, dto.status);
  }

  @Get('records')
  @RequirePermission('share:record')
  async listRecords(@Query() query: PaginationQueryDto) {
    return this.shareService.findShareRecords(query.page, query.pageSize);
  }

  @Get('invite-relations')
  @RequirePermission('share:invite')
  async listInviteRelations(@Query() query: PaginationQueryDto) {
    return this.shareService.findInviteRelations(query.page, query.pageSize);
  }

  @Get('stats')
  @RequirePermission('share:record')
  async getStats() {
    return this.shareService.getShareStats();
  }

  @Get('rewards')
  @RequirePermission('share:record')
  async findRewards(@Query() query: RewardQueryDto) {
    return this.shareService.findAllRewards({
      page: query.page,
      pageSize: query.pageSize,
      userId: query.userId,
      campaignId: query.campaignId,
      rewardType: query.rewardType,
      status: query.status,
      sourceType: query.sourceType,
    });
  }
}
