import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class SupplierQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

@Controller('admin/supplier')
export class AdminSupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get('list')
  @RequirePermission('product:supplier')
  async list(@Query() dto: SupplierQueryDto) {
    return this.supplierService.findAll(dto);
  }

  @Get('detail/:id')
  @RequirePermission('product:supplier')
  async detail(@Param('id') id: string) {
    return this.supplierService.findById(id);
  }

  @Post('create')
  @RequirePermission('product:supplier')
  async create(@Body() dto: CreateSupplierDto) {
    return this.supplierService.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('product:supplier')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateSupplierDto>) {
    return this.supplierService.update(id, dto);
  }

  @Delete('delete/:id')
  @RequirePermission('product:supplier')
  async delete(@Param('id') id: string) {
    return this.supplierService.delete(id);
  }

  @Put('status/:id')
  @RequirePermission('product:supplier')
  async updateStatus(@Param('id') id: string, @Body() body: { status: number }) {
    return this.supplierService.updateStatus(id, body.status);
  }
}
