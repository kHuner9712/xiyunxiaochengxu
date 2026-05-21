import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateContentDto } from './dto/create-content.dto';
import { ContentQueryDto } from './dto/content-query.dto';

@Controller('weapp/content')
export class WeappContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get('categories')
  async findCategories() {
    return this.contentService.findCategories();
  }

  @Public()
  @Get('list')
  async findPublished(@Query() dto: ContentQueryDto) {
    return this.contentService.findPublished(dto);
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.contentService.findById(id);
  }
}

@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('list')
  async list(@Query() dto: ContentQueryDto) {
    return this.contentService.findAllAdmin(dto);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.contentService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateContentDto) {
    return this.contentService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateContentDto>) {
    return this.contentService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.contentService.delete(id);
  }

  @Post('category')
  async createCategory(@Body() dto: { name: string; icon?: string; sortOrder?: number }) {
    return this.contentService.createCategory(dto);
  }

  @Put('category/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: { name?: string; icon?: string; sortOrder?: number }) {
    return this.contentService.updateCategory(id, dto);
  }

  @Delete('category/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.contentService.deleteCategory(id);
  }
}
