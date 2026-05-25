import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PickupStoreService } from './pickup-store.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('weapp/pickup-store')
export class WeappPickupStoreController {
  constructor(private readonly service: PickupStoreService) {}

  @Public()
  @Get('list')
  async list(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    return this.service.findPublished(Number(page), Number(pageSize));
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
  async list(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAllAdmin(Number(page), Number(pageSize), keyword, status ? Number(status) : undefined);
  }

  @Post()
  @RequirePermission('pickup:store')
  async create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermission('pickup:store')
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('pickup:store')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Put(':id/status')
  @RequirePermission('pickup:store')
  async updateStatus(@Param('id') id: string, @Body() dto: { status: number }) {
    return this.service.updateStatus(id, dto.status);
  }

  @Post('verify')
  @RequirePermission('pickup:verify')
  async verifyPickup(
    @Body() dto: { pickupCode: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.verifyPickupCode(dto.pickupCode, userId);
  }
}
