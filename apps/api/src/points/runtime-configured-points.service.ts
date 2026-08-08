import { Injectable } from '@nestjs/common';
import { POINTS_EXPIRE_MONTHS, POINTS_SIGN_IN_BASE, POINTS_SIGN_IN_MAX } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ProductionPointsService } from './production-points.service';

@Injectable()
export class RuntimeConfiguredPointsService extends ProductionPointsService {
  constructor(
    prisma: PrismaService,
    redisService: RedisService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    super(prisma, redisService);
  }

  override async getRules() {
    const config = this.systemConfigService.getRuntimeConfig();
    return [
      {
        action: '每日签到',
        points: POINTS_SIGN_IN_BASE,
        dailyLimit: 1,
        description: `每日签到${POINTS_SIGN_IN_BASE}积分起，连续签到递增，最高${POINTS_SIGN_IN_MAX}积分`,
      },
      {
        action: '积分抵扣',
        points: 0,
        dailyLimit: 0,
        description: `每${config.pointsDeductRate}积分抵扣1元，最多抵扣订单商品金额的${config.pointsDeductMaxPercent}%`,
      },
      {
        action: '积分有效期',
        points: 0,
        dailyLimit: 0,
        description: `积分有效期为${POINTS_EXPIRE_MONTHS}个月，请在有效期内使用`,
      },
    ];
  }
}
