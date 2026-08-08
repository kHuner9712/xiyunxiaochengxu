import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RequirePermission } from './decorators/require-permission.decorator';
import { parsePositiveBigIntId } from './utils/bigint-id';
import { BusinessEventQueryDto } from './dto/business-event-query.dto';

@Controller('admin/business-events')
@RequirePermission('system:log')
export class BusinessEventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('list')
  async list(@Query() dto: BusinessEventQueryDto) {
    const where: any = {};
    if (dto.level) where.level = dto.level;
    if (dto.bizType) where.bizType = dto.bizType;
    if (dto.eventType) where.eventType = dto.eventType;
    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.businessEvent.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
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
        page: dto.page,
        pageSize: dto.pageSize,
        total,
        totalPages: Math.ceil(total / dto.pageSize),
      },
    };
  }

  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    const eventId = parsePositiveBigIntId(id, '业务事件');
    const event = await this.prisma.businessEvent.findUnique({
      where: { id: eventId },
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
