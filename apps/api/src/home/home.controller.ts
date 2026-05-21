import { Controller, Get, Query } from '@nestjs/common';
import { HomeService } from './home.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('weapp/home')
export class WeappHomeController {
  constructor(private readonly homeService: HomeService) {}

  @Public()
  @Get('data')
  async getHomeData(@CurrentUser('id') userId?: string) {
    return this.homeService.getHomeData(userId);
  }

  @Public()
  @Get('guess')
  async getGuessProducts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.homeService.getGuessProducts(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }
}
