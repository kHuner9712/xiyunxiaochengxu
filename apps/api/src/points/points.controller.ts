import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PointsService } from './points.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { SignInDto } from './dto/sign-in.dto';
import { PointsQueryDto } from './dto/points-query.dto';

@Controller('weapp/points')
export class WeappPointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  async getBalance(@CurrentUser('id') userId: string) {
    return this.pointsService.getBalance(userId);
  }

  @Get('records')
  async records(@CurrentUser('id') userId: string, @Query() dto: PointsQueryDto) {
    return this.pointsService.findByUser(userId, dto);
  }

  @Post('sign-in')
  async signIn(@CurrentUser('id') userId: string, @Body() _dto: SignInDto) {
    return this.pointsService.signIn(userId);
  }

  @Get('sign-in/status')
  async signInStatus(@CurrentUser('id') userId: string) {
    return this.pointsService.getSignInStatus(userId);
  }

  @Get('rules')
  async getRules() {
    return this.pointsService.getRules();
  }
}

@Controller('admin/points')
export class AdminPointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('records')
  @RequirePermission('user:points')
  async records(@Query() dto: PointsQueryDto & { userId?: string }) {
    if (dto.userId) {
      return this.pointsService.findByUser(dto.userId, dto);
    }
    return { list: [], total: 0, page: dto.page, pageSize: dto.pageSize };
  }

  @Post('adjust')
  @RequirePermission('user:points')
  async adjust(@Body() body: { userId: string; points: number; description: string }) {
    return this.pointsService.adminAdjust(body.userId, body.points, body.description);
  }

  @Post('expire-clean')
  @RequirePermission('user:points')
  async expireClean() {
    return this.pointsService.cleanExpiredPoints();
  }
}
