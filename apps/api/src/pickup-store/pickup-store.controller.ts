import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PickupStoreService } from './pickup-store.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PickupCodeDto } from './dto/pickup-code.dto';
import {
  CreatePickupStoreDto,
  PickupStoreQueryDto,
  PickupStoreStatusDto,
  UpdatePickupStoreDto,
} from './dto/pickup-store.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('weapp/pickup-store')
export class WeappPickupStoreController {
  constructor(private readonly service: PickupStoreService) {}

  @Public()
  @Get('list')
  async list(@Query() query: PaginationDto) {
    return this.service.findPublished(query.page, query.pageSize);
  }

  @Public()
  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.service.findById(id);
  }
}

@Controller('admin/pickup-store')
export class AdminPickupStoreController {
  constructor(private readonly service: PickupStoreService) {}

  @Get('list')
  @RequirePermission('pickup:store')
  async list(@Query() query: PickupStoreQueryDto) {
    return this.service.findAllAdmin(query.page, query.pageSize, query.keyword, query.status);
  }

  @Get('preview')
  @RequirePermission('pickup:verify')
  async preview(@Query() dto: PickupCodeDto) {
    return this.service.previewPickupOrder(dto.pickupCode);
  }

  @Post()
  @RequirePermission('pickup:store')
  async create(@Body() dto: CreatePickupStoreDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermission('pickup:store')
  async update(@Param('id') id: string, @Body() dto: UpdatePickupStoreDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('pickup:store')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Put(':id/status')
  @RequirePermission('pickup:store')
  async updateStatus(@Param('id') id: string, @Body() dto: PickupStoreStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Post('verify')
  @RequirePermission('pickup:verify')
  async verifyPickup(
    @Body() dto: PickupCodeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.verifyPickupCode(dto.pickupCode, userId);
  }
}
