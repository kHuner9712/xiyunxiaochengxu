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
      buildSha: process.env.BUILD_SHA || 'unknown',
      maintenance: false,
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

      if ((process.env.NODE_ENV || 'development') === 'production') {
        const safety = await this.redis.getRuntimeSafetyConfig();
        const safetyOk = safety.maxmemoryPolicy === 'noeviction'
          && safety.appendonly === 'yes'
          && safety.appendfsync === 'everysec';
        result.services.redisSafety = safetyOk ? 'ok' : 'error';
        if (!safetyOk) {
          result.services.redis = 'error';
          result.status = 'degraded';
          isHealthy = false;
        }
      }
    } catch {
      result.services.redis = 'error';
      if ((process.env.NODE_ENV || 'development') === 'production') {
        result.services.redisSafety = 'error';
      }
      result.status = 'degraded';
      isHealthy = false;
    }

    try {
      const schedulerPaused = this.redis.isSchedulerPausedForCurrentBuild?.() ?? false;
      result.services.scheduler = schedulerPaused ? 'paused' : 'ok';
      result.maintenance = schedulerPaused;
      if (schedulerPaused) {
        // A shared migration marker is a global write-quiesce signal. Treat it as unhealthy so a
        // candidate container cannot be declared ready and exposed while schema maintenance is
        // still active or a stale marker remains after an interrupted migration.
        result.status = 'degraded';
        isHealthy = false;
      }
    } catch {
      result.services.scheduler = 'error';
      result.status = 'degraded';
      isHealthy = false;
    }

    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(result);
  }
}
