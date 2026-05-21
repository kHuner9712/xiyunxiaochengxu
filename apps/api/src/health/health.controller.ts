import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { Response } from 'express';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Public()
  @SkipTransform()
  @Get()
  async check(@Res() res: Response) {
    const result: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {} as Record<string, string>,
    };

    let isHealthy = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.services.database = 'ok';
    } catch {
      result.services.database = 'error';
      result.status = 'degraded';
      isHealthy = false;
    }

    try {
      const pong = await this.redis.ping();
      result.services.redis = pong === 'PONG' ? 'ok' : 'error';
      if (result.services.redis !== 'ok') {
        result.status = 'degraded';
        isHealthy = false;
      }
    } catch {
      result.services.redis = 'error';
      result.status = 'degraded';
      isHealthy = false;
    }

    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(result);
  }
}
