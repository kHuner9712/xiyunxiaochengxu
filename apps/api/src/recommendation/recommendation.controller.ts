import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { SaveRecommendationItemsDto } from './dto/save-recommendation-items.dto';
import { SaveRecommendationDto } from './dto/save-recommendation.dto';
import { RecommendationService } from './recommendation.service';

@Controller('admin/recommendation')
export class AdminRecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('list')
  @RequirePermission('marketing:recommendation')
  async list(@Query() dto: RecommendationQueryDto) {
    return this.recommendationService.findAll(dto);
  }

  @Post('create')
  @RequirePermission('marketing:recommendation')
  async create(@Body() dto: SaveRecommendationDto) {
    return this.recommendationService.create(dto);
  }

  @Put('update/:id')
  @RequirePermission('marketing:recommendation')
  async update(@Param('id') id: string, @Body() dto: SaveRecommendationDto) {
    return this.recommendationService.update(id, dto);
  }

  @Delete('delete/:id')
  @RequirePermission('marketing:recommendation')
  async delete(@Param('id') id: string) {
    return this.recommendationService.delete(id);
  }

  @Get('items/:id')
  @RequirePermission('marketing:recommendation')
  async items(@Param('id') id: string) {
    return this.recommendationService.findItems(id);
  }

  @Put('items/:id')
  @RequirePermission('marketing:recommendation')
  async saveItems(@Param('id') id: string, @Body() dto: SaveRecommendationItemsDto) {
    return this.recommendationService.saveItems(id, dto.items);
  }
}
