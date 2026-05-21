import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Public } from '../common/decorators/public.decorator';
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
  async list() {
    return this.categoryService.findAllAdmin();
  }

  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Post('create')
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Put('update/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete('delete/:id')
  async delete(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }
}
