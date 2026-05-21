import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
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
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('sales-chart')
  async getSalesChart(@Query() query: TrendQuery) {
    return this.dashboardService.getSalesChart(query.days || 7);
  }

  @Get('top-products')
  async getTopProducts(@Query('limit') limit?: number) {
    return this.dashboardService.getTopProducts(limit || 10);
  }

  @Get('recent-orders')
  async getRecentOrders(@Query('limit') limit?: number) {
    return this.dashboardService.getRecentOrders(limit || 10);
  }
}
