import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CouponQueryDto } from './dto/coupon-query.dto';

@Controller('weapp/coupon')
export class WeappCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Public()
  @Get('available')
  async findAvailable(@CurrentUser('id') userId: string) {
    return this.couponService.findAvailable(userId);
  }

  @Get('my')
  async findMyCoupons(
    @CurrentUser('id') userId: string,
    @Query('status') status?: number,
  ) {
    return this.couponService.findMyCoupons(userId, status ? Number(status) : undefined);
  }

  @Post('receive/:couponId')
  async receive(
    @CurrentUser('id') userId: string,
    @Param('couponId') couponId: string,
  ) {
    return this.couponService.receive(userId, couponId);
  }

  @Get('usable')
  async findUsable(
    @CurrentUser('id') userId: string,
    @Query('amount') amount?: number,
  ) {
    return this.couponService.findUsable(userId, amount ? Number(amount) : 0);
  }
}

@Controller('admin/coupon')
export class AdminCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get('list')
  @RequirePermission('marketing:coupon')
  async list(@Query() dto: CouponQueryDto) {
    return this.couponService.findAllAdmin(dto);
  }

  @Get(':id')
  @RequirePermission('marketing:coupon')
  async detail(@Param('id') id: string) {
    return this.couponService.findById(id);
  }

  @Post()
  @RequirePermission('marketing:coupon')
  async create(@Body() dto: CreateCouponDto) {
    return this.couponService.create({
      ...dto,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      applicableIds: dto.applicableIds ? JSON.stringify(dto.applicableIds) : null,
    });
  }

  @Put(':id')
  @RequirePermission('marketing:coupon')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);
    if (dto.applicableIds) data.applicableIds = JSON.stringify(dto.applicableIds);
    return this.couponService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('marketing:coupon')
  async delete(@Param('id') id: string) {
    return this.couponService.delete(id);
  }
}
