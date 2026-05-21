import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class TrendQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  days?: number;
}

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermission('dashboard')
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('sales-chart')
  @RequirePermission('dashboard')
  async getSalesChart(@Query() query: TrendQuery) {
    return this.dashboardService.getSalesChart(query.days || 7);
  }

  @Get('top-products')
  @RequirePermission('dashboard')
  async getTopProducts(@Query('limit') limit?: number) {
    return this.dashboardService.getTopProducts(limit || 10);
  }

  @Get('recent-orders')
  @RequirePermission('dashboard')
  async getRecentOrders(@Query('limit') limit?: number) {
    return this.dashboardService.getRecentOrders(limit || 10);
  }
}
