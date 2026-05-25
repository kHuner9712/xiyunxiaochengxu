import { Controller, Post, Get, Put, Body, Query, Param } from '@nestjs/common';
import { ShareService } from './share.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class ShareRecordDto {
  @IsString()
  @IsNotEmpty()
  shareType!: string;

  @IsOptional()
  @IsString()
  shareTargetId?: string;

  @IsOptional()
  @IsString()
  shareChannel?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  shareScene?: string;

  @IsOptional()
  @IsString()
  sharePath?: string;
}

class ShareVisitDto {
  @IsOptional()
  @IsString()
  shareRecordId?: string;

  @IsOptional()
  @IsString()
  inviter?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  sceneCode?: string;
}

class BindInviteDto {
  @IsOptional()
  @IsString()
  inviter?: string;

  @IsOptional()
  @IsString()
  shareRecordId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}

class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  rewardType!: string;

  @IsOptional()
  inviterRewardConfig?: any;

  @IsOptional()
  inviteeRewardConfig?: any;

  @IsNotEmpty()
  startTime!: string;

  @IsNotEmpty()
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  status?: number;
}

class UpdateCampaignStatusDto {
  @IsInt()
  @Type(() => Number)
  status!: number;
}

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
    @Query('type') type: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.shareService.getPoster(userId, type, targetId);
  }

  @Get('my-stats')
  async getMyStats(@CurrentUser('id') userId: string) {
    return this.shareService.getMyStats(userId);
  }
}

@Controller('admin/share')
export class AdminShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('campaign/list')
  @RequirePermission('share:campaign')
  async listCampaigns(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.shareService.findAllCampaigns(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }

  @Post('campaign')
  @RequirePermission('share:campaign')
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.shareService.createCampaign(dto);
  }

  @Put('campaign/:id')
  @RequirePermission('share:campaign')
  async updateCampaign(@Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.shareService.updateCampaign(id, dto);
  }

  @Put('campaign/:id/status')
  @RequirePermission('share:campaign')
  async updateCampaignStatus(@Param('id') id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.shareService.updateCampaignStatus(id, dto.status);
  }

  @Get('records')
  @RequirePermission('share:record')
  async listRecords(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.shareService.findShareRecords(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }

  @Get('invite-relations')
  @RequirePermission('share:invite')
  async listInviteRelations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.shareService.findInviteRelations(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }

  @Get('stats')
  @RequirePermission('share:record')
  async getStats() {
    return this.shareService.getShareStats();
  }
}
