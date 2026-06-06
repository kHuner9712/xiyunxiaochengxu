import { Controller, Get, Delete, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';

@Controller('weapp/search')
export class WeappSearchController {
  constructor(private readonly searchService: SearchService) {}

  @OptionalAuth()
  @Get()
  async search(
    @Query('keyword') keyword?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.searchService.search(
      keyword || '',
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
      sort,
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
