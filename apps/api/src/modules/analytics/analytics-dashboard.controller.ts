import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg } from '../../auth/current-org.decorator.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsQueryDto } from './dto/analytics-query.dto.js';

@Controller('analytics')
@UseGuards(SessionGuard)
export class AnalyticsDashboardController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  getSummary(@CurrentOrg() orgId: string, @Query() query: AnalyticsQueryDto) {
    return this.analytics.getSummary(orgId, query.range ?? '30d');
  }
}
