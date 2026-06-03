import { Controller, Get, Header, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import { StatisticsService } from './statistics.service';

@Controller('admin/statistics')
export class AdminStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  @RequirePermission('statistics:index')
  async overview(@Query() dto: StatisticsQueryDto) {
    return this.statisticsService.getOverview(dto);
  }

  @Get('export')
  @RequirePermission('statistics:index')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="statistics.csv"')
  async export(@Query() dto: StatisticsQueryDto) {
    return this.statisticsService.exportOverview(dto);
  }
}
