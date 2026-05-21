import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ShareService } from './share.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
}

@Controller('weapp/share')
export class WeappShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post('record')
  async record(
    @CurrentUser('id') userId: string,
    @Body() dto: ShareRecordDto,
  ) {
    return this.shareService.recordShare(userId, dto.shareType, dto.shareTargetId, dto.shareChannel);
  }

  @Get('poster')
  async getPoster(
    @CurrentUser('id') userId: string,
    @Query('type') type: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.shareService.getPoster(userId, type, targetId);
  }
}
