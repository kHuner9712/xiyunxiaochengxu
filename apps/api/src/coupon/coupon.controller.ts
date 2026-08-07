import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import {
  CouponQueryDto,
  CouponListQueryDto,
  UserCouponListQueryDto,
  UsableCouponQueryDto,
} from './dto/coupon-query.dto';

@Controller('weapp/coupon')
export class WeappCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Public()
  @Get('center')
  async findCenterList(@Query() query: CouponListQueryDto) {
    return this.couponService.findCenterList(query.page, query.pageSize);
  }

  @Get('available')
  async findAvailable(@CurrentUser('id') userId: string) {
    return this.couponService.findAvailable(userId);
  }

  @Get('my')
  async findMyCoupons(
    @CurrentUser('id') userId: string,
    @Query() query: UserCouponListQueryDto,
  ) {
    return this.couponService.findMyCoupons(userId, query.status, query.page, query.pageSize);
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
    @Query() query: UsableCouponQueryDto,
  ) {
    return this.couponService.findUsable(userId, query.amount, query.productIds);
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
    return this.couponService.create(dto);
  }

  @Put(':id')
  @RequirePermission('marketing:coupon')
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing:coupon')
  async delete(@Param('id') id: string) {
    return this.couponService.delete(id);
  }
}
