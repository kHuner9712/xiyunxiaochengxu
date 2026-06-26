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
import { BenefitPackageService } from './benefit-package.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  BenefitPackageQueryDto,
  UserBenefitPackageQueryDto,
  EntitlementQueryDto,
  VerificationLogQueryDto,
  VerifyBenefitDto,
} from './dto/benefit-package.dto';

@Controller('weapp/benefit-package')
export class WeappBenefitPackageController {
  constructor(private readonly service: BenefitPackageService) {}

  @Public()
  @Get('list')
  async list(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    return this.service.findPublished(Number(page), Number(pageSize));
  }

  @Public()
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.service.findDetailForWeapp(id);
  }

  @Get('my-packages')
  async myPackages(
    @CurrentUser('id') userId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    return this.service.findMyPackages(userId, Number(page), Number(pageSize));
  }

  @Get('my-entitlements')
  async myEntitlements(
    @CurrentUser('id') userId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    return this.service.findMyEntitlements(userId, Number(page), Number(pageSize));
  }

  @Get('entitlement/:id')
  async entitlement(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findEntitlementForUser(userId, id);
  }
}

@Controller('admin/benefit-package')
export class AdminBenefitPackageController {
  constructor(private readonly service: BenefitPackageService) {}

  // ===== 权益包配置 =====

  @Get('list')
  @RequirePermission('marketing:activity')
  async list(@Query() dto: BenefitPackageQueryDto) {
    return this.service.findAllAdmin(dto);
  }

  @Get('detail/:id')
  @RequirePermission('marketing:activity')
  async detail(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post('create')
  @RequirePermission('marketing:activity')
  async create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('marketing:activity')
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Put('status/:id')
  @RequirePermission('marketing:activity')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: number },
  ) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete('delete/:id')
  @RequirePermission('marketing:activity')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // ===== 用户权益 / 核销 / 记录 =====

  @Get('user-packages')
  @RequirePermission('marketing:activity')
  async userPackages(@Query() dto: UserBenefitPackageQueryDto) {
    return this.service.findUserPackages(dto);
  }

  @Get('entitlements')
  @RequirePermission('marketing:activity')
  async entitlements(@Query() dto: EntitlementQueryDto) {
    return this.service.findEntitlements(dto);
  }

  @Get('verify/preview')
  @RequirePermission('pickup:verify')
  async verifyPreview(@Query('verifyCode') verifyCode: string) {
    return this.service.previewVerify(verifyCode);
  }

  @Post('verify')
  @RequirePermission('pickup:verify')
  async verify(@Body() dto: VerifyBenefitDto, @CurrentUser('id') userId: string) {
    return this.service.verify(dto.verifyCode, userId, dto.remark);
  }

  @Get('verification-logs')
  @RequirePermission('marketing:activity')
  async verificationLogs(@Query() dto: VerificationLogQueryDto) {
    return this.service.findVerificationLogs(dto);
  }

  @Get('stats')
  @RequirePermission('marketing:activity')
  async stats() {
    return this.service.getStats();
  }
}
