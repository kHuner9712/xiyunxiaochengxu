import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  ActivityContentQueryDto,
  CreateActivityContentDto,
  UpdateActivityContentDto,
  UpdateActivityContentStatusDto,
} from './dto/activity-content.dto';
import { ActivityContentService } from './activity-content.service';

@Controller('admin/activity-content')
export class AdminActivityContentController {
  constructor(private readonly activityContentService: ActivityContentService) {}

  @Get('list')
  @RequirePermission('marketing:activity')
  async list(@Query() dto: ActivityContentQueryDto) {
    return this.activityContentService.findAll(dto);
  }

  @Get('detail/:id')
  @RequirePermission('marketing:activity')
  async detail(@Param('id') id: string) {
    return this.activityContentService.findById(id);
  }

  @Post('create')
  @RequirePermission('marketing:activity')
  async create(@Body() dto: CreateActivityContentDto) {
    return this.activityContentService.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('marketing:activity')
  async update(@Param('id') id: string, @Body() dto: UpdateActivityContentDto) {
    return this.activityContentService.update(id, dto);
  }

  @Put('status/:id')
  @RequirePermission('marketing:activity')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateActivityContentStatusDto) {
    return this.activityContentService.updateStatus(id, dto.status);
  }

  @Delete('delete/:id')
  @RequirePermission('marketing:activity')
  async delete(@Param('id') id: string) {
    return this.activityContentService.softDelete(id);
  }
}

@Controller('weapp/activity-content')
export class WeappActivityContentController {
  constructor(private readonly activityContentService: ActivityContentService) {}

  @Public()
  @Get('list')
  async list(@Query() dto: ActivityContentQueryDto) {
    return this.activityContentService.findWeappList(dto);
  }

  @Public()
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.activityContentService.findWeappDetail(id);
  }
}
