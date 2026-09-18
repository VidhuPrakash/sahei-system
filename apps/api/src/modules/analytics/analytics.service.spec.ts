import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';

function makePrismaMock() {
  return {
    callTranscript: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    inquiry: {
      groupBy: vi.fn(),
    },
  };
}

describe('AnalyticsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let analytics: AnalyticsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T12:00:00.000Z'));
    prisma = makePrismaMock();
    prisma.callTranscript.findMany.mockResolvedValue([]);
    prisma.callTranscript.groupBy.mockResolvedValue([]);
    prisma.inquiry.groupBy.mockResolvedValue([]);
    analytics = new AnalyticsService(prisma as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scopes every query to the org via the business relation', async () => {
    await analytics.getSummary('org-1', '7d');

    expect(prisma.callTranscript.findMany).toHaveBeenCalledWith({
      where: { business: { orgId: 'org-1' }, startedAt: { gte: expect.any(Date) } },
      select: { startedAt: true },
    });
    expect(prisma.callTranscript.groupBy).toHaveBeenCalledWith({
      by: ['outcome'],
      where: { business: { orgId: 'org-1' }, startedAt: { gte: expect.any(Date) } },
      _count: true,
    });
    expect(prisma.inquiry.groupBy).toHaveBeenCalledWith({
      by: ['category'],
      where: { business: { orgId: 'org-1' }, createdAt: { gte: expect.any(Date) } },
      _count: true,
      orderBy: { _count: { category: 'desc' } },
    });
  });

  it('buckets call volume by day, filling gaps with zero, inclusive of the range boundary', async () => {
    prisma.callTranscript.findMany.mockResolvedValue([
      { startedAt: new Date('2026-09-15T03:00:00.000Z') },
      { startedAt: new Date('2026-09-15T20:00:00.000Z') },
      { startedAt: new Date('2026-09-18T01:00:00.000Z') },
    ]);

    const summary = await analytics.getSummary('org-1', '7d');

    expect(summary.callVolume).toEqual([
      { date: '2026-09-11', count: 0 },
      { date: '2026-09-12', count: 0 },
      { date: '2026-09-13', count: 0 },
      { date: '2026-09-14', count: 0 },
      { date: '2026-09-15', count: 2 },
      { date: '2026-09-16', count: 0 },
      { date: '2026-09-17', count: 0 },
      { date: '2026-09-18', count: 1 },
    ]);
  });

  it('computes conversion rate from the BOOKED outcome count', async () => {
    prisma.callTranscript.groupBy.mockResolvedValue([
      { outcome: 'BOOKED', _count: 2 },
      { outcome: 'INQUIRY', _count: 1 },
    ]);

    const summary = await analytics.getSummary('org-1', '30d');

    expect(summary.conversion).toEqual({ totalCalls: 3, booked: 2, conversionRate: 2 / 3 });
  });

  it('reports a zero conversion rate instead of dividing by zero when there are no calls', async () => {
    const summary = await analytics.getSummary('org-1', '30d');

    expect(summary.conversion).toEqual({ totalCalls: 0, booked: 0, conversionRate: 0 });
  });

  it('maps inquiry category groups to query themes in the ranked order Prisma returns', async () => {
    prisma.inquiry.groupBy.mockResolvedValue([
      { category: 'BUSINESS_QUESTION', _count: 5 },
      { category: 'OTHER', _count: 2 },
    ]);

    const summary = await analytics.getSummary('org-1', '90d');

    expect(summary.themes).toEqual([
      { category: 'BUSINESS_QUESTION', count: 5 },
      { category: 'OTHER', count: 2 },
    ]);
  });
});
