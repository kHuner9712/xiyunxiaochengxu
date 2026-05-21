import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { BrandService } from './brand.service';
import { Public } from '../common/decorators/public.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { IsOptional, IsString } from 'class-validator';

class BrandQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;
}

@Controller('weapp/brand')
export class WeappBrandController {
  constructor(private readonly brandService: BrandService) {}

  @Public()
  @Get('list')
  async list(@Query() dto: PaginationDto) {
    return this.brandService.findPublished(dto);
  }
}

@Controller('admin/brand')
export class AdminBrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get('list')
  async list(@Query() dto: BrandQueryDto) {
    return this.brandService.findAllAdmin(dto);
  }

  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.brandService.findById(id);
  }

  @Post('create')
  async create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @Put('update/:id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateBrandDto>) {
    return this.brandService.update(id, dto);
  }

  @Delete('delete/:id')
  async delete(@Param('id') id: string) {
    return this.brandService.delete(id);
  }
}
