import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsDateString, IsInt, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class TrendQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  days?: number;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
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
    if (query.startDate || query.endDate) {
      if (!query.startDate || !query.endDate) {
        throw new BadRequestException('startDate and endDate must be provided together');
      }
      return this.dashboardService.getSalesChartByDateRange(query.startDate, query.endDate);
    }
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
