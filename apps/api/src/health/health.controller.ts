import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Public()
  @SkipTransform()
  @Get()
  async check() {
    const result: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {} as Record<string, string>,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.services.database = 'ok';
    } catch {
      result.services.database = 'error';
      result.status = 'degraded';
    }

    try {
      const pong = await this.redis.ping();
      result.services.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      result.services.redis = 'error';
      result.status = 'degraded';
    }

    return result;
  }
}
