import { Controller, Get, Delete, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('weapp/search')
export class WeappSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get('hot')
  async getHotKeywords() {
    return this.searchService.getHotKeywords();
  }

  @Get('history')
  async getSearchHistory(@CurrentUser('id') userId: string) {
    return this.searchService.getSearchHistory(userId);
  }

  @Delete('history')
  async clearSearchHistory(@CurrentUser('id') userId: string) {
    return this.searchService.clearSearchHistory(userId);
  }
}
