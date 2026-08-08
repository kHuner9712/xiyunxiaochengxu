import { Controller, Get, Delete, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('weapp/search')
export class WeappSearchController {
  constructor(private readonly searchService: SearchService) {}

  @OptionalAuth()
  @Get()
  async search(
    @Query() query: SearchQueryDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.searchService.search(
      query.keyword || '',
      query.page,
      query.pageSize,
      query.sort,
      userId,
    );
  }

  @Public()
  @Get('hot')
  async getHotKeywords() {
    return this.searchService.getHotKeywords();
  }

  @OptionalAuth()
  @Get('history')
  async getSearchHistory(@CurrentUser('id') userId?: string) {
    return this.searchService.getSearchHistory(userId);
  }

  @OptionalAuth()
  @Delete('history')
  async clearSearchHistory(@CurrentUser('id') userId?: string) {
    return this.searchService.clearSearchHistory(userId);
  }
}
