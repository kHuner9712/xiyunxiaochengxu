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
  CreateCommissionRuleDto,
  UpdateCommissionRuleDto,
  CommissionRuleStatusDto,
  CommissionRecordQueryDto,
  CommissionRecordStatusDto,
  SettlementBatchQueryDto,
  CreateSettlementBatchDto,
  SettlementBatchRemarkDto,
  SettlementReportQueryDto,
} from './dto/merchant-settlement.dto';

const SETTLEMENT_PERMISSION = 'order:merchant-settlement';

@Controller('admin/merchant-settlement')
export class AdminMerchantSettlementController {
  constructor(private readonly service: MerchantSettlementService) {}

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
  async ruleCreate(@Body() dto: CreateCommissionRuleDto) {
    return this.service.createRule(dto);
  }

  @Put('rule/update/:id')
  @RequirePermission('marketing:activity')
  async ruleUpdate(@Param('id') id: string, @Body() dto: UpdateCommissionRuleDto) {
    return this.service.updateRule(id, dto);
  }

  @Put('rule/status/:id')
  @RequirePermission('marketing:activity')
  async ruleUpdateStatus(
    @Param('id') id: string,
    @Body() dto: CommissionRuleStatusDto,
  ) {
    return this.service.updateRuleStatus(id, dto.status);
  }

  @Delete('delete/rule/:id')
  @RequirePermission('marketing:activity')
  async ruleDelete(@Param('id') id: string) {
    return this.service.deleteRule(id);
  }

  @Get('records')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async records(@Query() dto: CommissionRecordQueryDto) {
    return this.service.findRecords(dto);
  }

  @Get('records/stats')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async recordsStats() {
    return this.service.getRecordsStats();
  }

  @Put('records/:id/status')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async recordUpdateStatus(
    @Param('id') id: string,
    @Body() dto: CommissionRecordStatusDto,
  ) {
    return this.service.updateRecordStatus(id, dto.status, dto.remark);
  }

  @Get('batches')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batches(@Query() dto: SettlementBatchQueryDto) {
    return this.service.findBatches(dto);
  }

  @Get('batches/:id')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batchDetail(@Param('id') id: string) {
    return this.service.findBatchById(id);
  }

  @Post('batches/preview')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batchPreview(@Body() dto: CreateSettlementBatchDto) {
    return this.service.previewBatch(dto);
  }

  @Post('batches/create')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batchCreate(@Body() dto: CreateSettlementBatchDto) {
    return this.service.createBatch(dto);
  }

  @Put('batches/:id/confirm')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batchConfirm(
    @Param('id') id: string,
    @Body() dto: SettlementBatchRemarkDto,
  ) {
    return this.service.confirmBatch(id, dto.remark);
  }

  @Put('batches/:id/paid')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batchPaid(
    @Param('id') id: string,
    @Body() dto: SettlementBatchRemarkDto,
  ) {
    return this.service.markBatchPaid(id, dto.remark);
  }

  @Put('batches/:id/cancel')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async batchCancel(
    @Param('id') id: string,
    @Body() dto: SettlementBatchRemarkDto,
  ) {
    return this.service.cancelBatch(id, dto.remark);
  }

  @Get('report/merchant')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async reportMerchant(@Query() dto: SettlementReportQueryDto) {
    return this.service.reportByMerchant(dto);
  }

  @Get('report/monthly')
  @RequirePermission(SETTLEMENT_PERMISSION)
  async reportMonthly(@Query() dto: SettlementReportQueryDto) {
    return this.service.reportMonthly(dto);
  }
}
