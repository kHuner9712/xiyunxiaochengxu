import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { BabyProfileService } from './baby-profile.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBabyProfileDto } from './dto/create-baby-profile.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('weapp/baby-profile')
export class WeappBabyProfileController {
  constructor(private readonly babyProfileService: BabyProfileService) {}

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.babyProfileService.findAll(userId);
  }

  @Get(':id')
  async findById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.babyProfileService.findById(userId, id);
  }

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateBabyProfileDto) {
    return this.babyProfileService.create(userId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateBabyProfileDto>,
  ) {
    return this.babyProfileService.update(userId, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.babyProfileService.delete(userId, id);
  }
}

@Controller('admin/baby-profile')
export class AdminBabyProfileController {
  constructor(private readonly babyProfileService: BabyProfileService) {}

  @Get()
  @RequirePermission('user:detail')
  async list(@Query() dto: PaginationDto & { userId?: string }) {
    return this.babyProfileService.findAllAdmin(dto);
  }
}
