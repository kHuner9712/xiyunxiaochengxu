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
import { PrismaService } from '../common/prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { paginate } from '@baby-mall/shared';
import {
  BenefitPackagePublicQueryDto,
  MyBenefitPackageQueryDto,
  MyBenefitEntitlementQueryDto,
  BenefitPackageQueryDto,
  UserBenefitPackageQueryDto,
  EntitlementQueryDto,
  VerificationLogQueryDto,
  VerifyBenefitDto,
  CreateBenefitPackageDto,
  UpdateBenefitPackageDto,
  BenefitPackageStatusDto,
} from './dto/benefit-package.dto';

@Controller('weapp/benefit-package')
export class WeappBenefitPackageController {
  constructor(
    private readonly service: BenefitPackageService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('list')
  async list(@Query() dto: BenefitPackagePublicQueryDto) {
    return this.service.findPublished(dto.page, dto.pageSize);
  }

  @Public()
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.service.findDetailForWeapp(id);
  }

  @Get('my-packages')
  async myPackages(
    @CurrentUser('id') userId: string,
    @Query() dto: MyBenefitPackageQueryDto,
  ) {
    const result: any = await this.service.findUserPackages({ ...dto, userId });
    return {
      ...result,
      list: (result.list ?? []).map((row: any) => ({
        ...row,
        packageCoverImage: row.packageCoverImage ?? row.coverImage ?? null,
      })),
    };
  }

  @Get('my-entitlements')
  async myEntitlements(
    @CurrentUser('id') userId: string,
    @Query() dto: MyBenefitEntitlementQueryDto,
  ) {
    if (!dto.packageId) {
      return this.service.findEntitlements({ ...dto, userId });
    }

    // In the miniprogram, packageId identifies one concrete UserBenefitPackage card, not the
    // reusable BenefitPackage template. Users can buy the same package more than once; filtering
    // by the template id would merge entitlements from every purchase and make both cards open the
    // same verification-code list.
    const userBenefitPackageId = parsePositiveBigIntId(dto.packageId, '权益卡');
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const where = {
      userId: userIdValue,
      userBenefitPackageId,
      deletedAt: null,
      ...(dto.status ? { status: dto.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.userBenefitEntitlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        select: { id: true },
      }),
      this.prisma.userBenefitEntitlement.count({ where }),
    ]);
    const list = await Promise.all(
      rows.map((row) => this.service.findEntitlementForUser(userId, row.id.toString())),
    );
    return paginate(list, total, dto.page, dto.pageSize);
  }

  @Get('entitlement/:id')
  async entitlement(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findEntitlementForUser(userId, id);
  }
}

@Controller('admin/benefit-package')
export class AdminBenefitPackageController {
  constructor(private readonly service: BenefitPackageService) {}

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
  async create(@Body() dto: CreateBenefitPackageDto) {
    return this.service.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('marketing:activity')
  async update(@Param('id') id: string, @Body() dto: UpdateBenefitPackageDto) {
    return this.service.update(id, dto);
  }

  @Put('status/:id')
  @RequirePermission('marketing:activity')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: BenefitPackageStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete('delete/:id')
  @RequirePermission('marketing:activity')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

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
