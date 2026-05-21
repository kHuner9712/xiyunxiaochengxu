import { Module } from '@nestjs/common';
import { WeappSearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [WeappSearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
