import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('weapp/category')
export class WeappCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get('tree')
  async tree() {
    return this.categoryService.findTree();
  }
}

@Controller('admin/category')
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('list')
  @RequirePermission('product:category')
  async list() {
    return this.categoryService.findAllAdmin();
  }

  @Get('detail/:id')
  @RequirePermission('product:category')
  async detail(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Post('create')
  @RequirePermission('product:category')
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('product:category')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete('delete/:id')
  @RequirePermission('product:category')
  async delete(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }
}
