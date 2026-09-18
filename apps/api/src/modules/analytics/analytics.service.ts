import { Injectable } from '@nestjs/common';
import type { AnalyticsRange, AnalyticsSummary, CallVolumePoint, InquiryCategory, QueryTheme } from '@sahei/types';
import { PrismaService } from '../../prisma/prisma.service.js';

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function bucketByDay(startedAtValues: Date[], from: Date, to: Date): CallVolumePoint[] {
  const counts = new Map<string, number>();
  for (const startedAt of startedAtValues) {
    const key = dayKey(startedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: CallVolumePoint[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor <= end) {
    const key = dayKey(cursor);
    points.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - RANGE_DAYS[range]);

    const [calls, outcomeGroups, themeGroups] = await Promise.all([
      this.prisma.callTranscript.findMany({
        where: { business: { orgId }, startedAt: { gte: from } },
        select: { startedAt: true },
      }),
      this.prisma.callTranscript.groupBy({
        by: ['outcome'],
        where: { business: { orgId }, startedAt: { gte: from } },
        _count: true,
      }),
      this.prisma.inquiry.groupBy({
        by: ['category'],
        where: { business: { orgId }, createdAt: { gte: from } },
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      }),
    ]);

    const totalCalls = outcomeGroups.reduce((sum, group) => sum + group._count, 0);
    const booked = outcomeGroups.find((group) => group.outcome === 'BOOKED')?._count ?? 0;

    const themes: QueryTheme[] = themeGroups.map((group) => ({
      category: group.category as InquiryCategory,
      count: group._count,
    }));

    return {
      range,
      callVolume: bucketByDay(
        calls.map((call) => call.startedAt),
        from,
        to,
      ),
      conversion: {
        totalCalls,
        booked,
        conversionRate: totalCalls === 0 ? 0 : booked / totalCalls,
      },
      themes,
    };
  }
}
