import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { StockAdjustDto } from './dto/stock-adjust.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockService } from './stock.service';

@Controller('admin/stock')
export class AdminStockController {
  constructor(private readonly stockService: StockService) {}

  @Get('list')
  @RequirePermission('product:stock')
  async list(@Query() dto: StockQueryDto) {
    return this.stockService.findList(dto);
  }

  @Get('logs')
  @RequirePermission('product:stock')
  async logs(@Query() dto: StockQueryDto) {
    return this.stockService.findLogs(dto);
  }

  @Post('adjust')
  @RequirePermission('product:stock')
  async adjust(@Body() dto: StockAdjustDto, @CurrentUser('id') adminUserId?: string) {
    return this.stockService.adjust(dto, adminUserId);
  }
}
