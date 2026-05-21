import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('weapp/product')
export class WeappProductController {
  constructor(private readonly productService: ProductService) {}

  @Public()
  @Get('list')
  async list(@Query() dto: ProductQueryDto) {
    return this.productService.findPublished(dto);
  }

  @Public()
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Public()
  @Get('recommend')
  async recommend(@Query() dto: ProductQueryDto) {
    return this.productService.findRecommend(dto);
  }
}

@Controller('admin/product')
export class AdminProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('list')
  @RequirePermission('product:list')
  async list(@Query() dto: ProductQueryDto) {
    return this.productService.findAllAdmin(dto);
  }

  @Get('detail/:id')
  @RequirePermission('product:list')
  async detail(@Param('id') id: string) {
    return this.productService.findAdminById(id);
  }

  @Post('create')
  @RequirePermission('product:create')
  async create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('product:update')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete('delete/:id')
  @RequirePermission('product:delete')
  async delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @Put('status/:id')
  @RequirePermission('product:publish')
  async updateStatus(@Param('id') id: string, @Body() body: { status: number }) {
    return this.productService.updateStatus(id, body.status);
  }
}
