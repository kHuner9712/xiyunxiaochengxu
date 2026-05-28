import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { AftersaleService } from './aftersale.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateAftersaleDto } from './dto/create-aftersale.dto';
import { RejectDto } from './dto/reject.dto';
import { ReturnLogisticsDto } from './dto/return-logistics.dto';
import { ApproveAftersaleDto } from './dto/approve-aftersale.dto';
import { IsOptional, IsString } from 'class-validator';

class AdminAftersaleQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;
}

@Controller('weapp/aftersale')
export class WeappAftersaleController {
  constructor(private readonly aftersaleService: AftersaleService) {}

  @Post('create')
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateAftersaleDto) {
    return this.aftersaleService.create(userId, dto);
  }

  @Get('list')
  async list(@CurrentUser('id') userId: string, @Query() dto: PaginationDto) {
    return this.aftersaleService.findByUser(userId, dto);
  }

  @Get('detail/:id')
  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aftersaleService.findUserDetail(userId, id);
  }

  @Put('return-logistics/:id')
  async fillReturnLogistics(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ReturnLogisticsDto,
  ) {
    return this.aftersaleService.fillReturnLogistics(userId, id, dto);
  }

  @Put('cancel/:id')
  async cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aftersaleService.cancel(userId, id);
  }
}

@Controller('admin/aftersale')
export class AdminAftersaleController {
  constructor(private readonly aftersaleService: AftersaleService) {}

  @Get('list')
  @RequirePermission('order:aftersale')
  async list(@Query() dto: AdminAftersaleQueryDto) {
    return this.aftersaleService.findAllAdmin(dto);
  }

  @Get('detail/:id')
  @RequirePermission('order:aftersale')
  async detail(@Param('id') id: string) {
    return this.aftersaleService.findAdminDetail(id);
  }

  @Put(':id/approve')
  @RequirePermission('order:aftersale:review')
  async approve(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ApproveAftersaleDto,
  ) {
    return this.aftersaleService.approve(id, adminId, dto.refundAmount);
  }

  @Put(':id/reject')
  @RequirePermission('order:aftersale:review')
  async reject(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: RejectDto,
  ) {
    return this.aftersaleService.reject(id, adminId, dto.rejectReason);
  }

  @Put(':id/refund')
  @RequirePermission('order:aftersale:refund')
  async refund(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.aftersaleService.refund(id, adminId);
  }
}
