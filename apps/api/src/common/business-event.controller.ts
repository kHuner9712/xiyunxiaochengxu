import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RequirePermission } from './decorators/require-permission.decorator';

@Controller('admin/business-events')
@RequirePermission('system:log')
export class BusinessEventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('list')
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('level') level?: string,
    @Query('bizType') bizType?: string,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const skip = (p - 1) * ps;

    const where: any = {};
    if (level) where.level = level;
    if (bizType) where.bizType = bizType;
    if (eventType) where.eventType = eventType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.businessEvent.findMany({
        where,
        skip,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.businessEvent.count({ where }),
    ]);

    return {
      list: items.map(item => ({
        ...item,
        id: item.id.toString(),
      })),
      pagination: {
        page: p,
        pageSize: ps,
        total,
        totalPages: Math.ceil(total / ps),
      },
    };
  }

  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    const event = await this.prisma.businessEvent.findUnique({
      where: { id: BigInt(id) },
    });
    if (!event) {
      return { error: '事件不存在' };
    }
    return {
      ...event,
      id: event.id.toString(),
    };
  }
}
