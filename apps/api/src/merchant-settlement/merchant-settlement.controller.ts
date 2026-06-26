import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { MerchantSettlementService } from './merchant-settlement.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CommissionRuleQueryDto,
  CommissionRecordQueryDto,
  CommissionRecordStatusDto,
  SettlementBatchQueryDto,
  CreateSettlementBatchDto,
  SettlementBatchRemarkDto,
  SettlementReportQueryDto,
} from './dto/merchant-settlement.dto';

@Controller('admin/merchant-settlement')
export class AdminMerchantSettlementController {
  constructor(private readonly service: MerchantSettlementService) {}

  // ===== 规则管理 =====

  @Get('rule/list')
  @RequirePermission('marketing:activity')
  async ruleList(@Query() dto: CommissionRuleQueryDto) {
    return this.service.findRules(dto);
  }

  @Get('rule/detail/:id')
  @RequirePermission('marketing:activity')
  async ruleDetail(@Param('id') id: string) {
    return this.service.findRuleById(id);
  }

  @Post('rule/create')
  @RequirePermission('marketing:activity')
  async ruleCreate(@Body() dto: any) {
    return this.service.createRule(dto);
  }

  @Put('rule/update/:id')
  @RequirePermission('marketing:activity')
  async ruleUpdate(@Param('id') id: string, @Body() dto: any) {
    return this.service.updateRule(id, dto);
  }

  @Put('rule/status/:id')
  @RequirePermission('marketing:activity')
  async ruleUpdateStatus(
    @Param('id') id: string,
    @Body() dto: { status: number },
  ) {
    return this.service.updateRuleStatus(id, dto.status);
  }

  @Delete('delete/rule/:id')
  @RequirePermission('marketing:activity')
  async ruleDelete(@Param('id') id: string) {
    return this.service.deleteRule(id);
  }

  // ===== 分佣明细 =====

  @Get('records')
  @RequirePermission('marketing:activity')
  async records(@Query() dto: CommissionRecordQueryDto) {
    return this.service.findRecords(dto);
  }

  @Get('records/stats')
  @RequirePermission('marketing:activity')
  async recordsStats() {
    return this.service.getRecordsStats();
  }

  @Put('records/:id/status')
  @RequirePermission('marketing:activity')
  async recordUpdateStatus(
    @Param('id') id: string,
    @Body() dto: CommissionRecordStatusDto,
  ) {
    return this.service.updateRecordStatus(id, dto.status, dto.remark);
  }

  // ===== 结算批次 =====

  @Get('batches')
  @RequirePermission('marketing:activity')
  async batches(@Query() dto: SettlementBatchQueryDto) {
    return this.service.findBatches(dto);
  }

  @Get('batches/:id')
  @RequirePermission('marketing:activity')
  async batchDetail(@Param('id') id: string) {
    return this.service.findBatchById(id);
  }

  @Post('batches/preview')
  @RequirePermission('marketing:activity')
  async batchPreview(@Body() dto: CreateSettlementBatchDto) {
    return this.service.previewBatch(dto);
  }

  @Post('batches/create')
  @RequirePermission('marketing:activity')
  async batchCreate(@Body() dto: CreateSettlementBatchDto) {
    return this.service.createBatch(dto);
  }

  @Put('batches/:id/confirm')
  @RequirePermission('marketing:activity')
  async batchConfirm(
    @Param('id') id: string,
    @Body() dto: SettlementBatchRemarkDto,
  ) {
    return this.service.confirmBatch(id, dto.remark);
  }

  @Put('batches/:id/paid')
  @RequirePermission('marketing:activity')
  async batchPaid(
    @Param('id') id: string,
    @Body() dto: SettlementBatchRemarkDto,
  ) {
    return this.service.markBatchPaid(id, dto.remark);
  }

  @Put('batches/:id/cancel')
  @RequirePermission('marketing:activity')
  async batchCancel(
    @Param('id') id: string,
    @Body() dto: SettlementBatchRemarkDto,
  ) {
    return this.service.cancelBatch(id, dto.remark);
  }

  // ===== 报表 =====

  @Get('report/merchant')
  @RequirePermission('marketing:activity')
  async reportMerchant(@Query() dto: SettlementReportQueryDto) {
    return this.service.reportByMerchant(dto);
  }

  @Get('report/monthly')
  @RequirePermission('marketing:activity')
  async reportMonthly(@Query() dto: SettlementReportQueryDto) {
    return this.service.reportMonthly(dto);
  }
}
