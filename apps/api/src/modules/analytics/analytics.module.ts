import { Module } from '@nestjs/common';
import { AnalyticsDashboardController } from './analytics-dashboard.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  controllers: [AnalyticsDashboardController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
