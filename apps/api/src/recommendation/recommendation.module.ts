import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AdminRecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminRecommendationController],
  providers: [RecommendationService],
})
export class RecommendationModule {}
