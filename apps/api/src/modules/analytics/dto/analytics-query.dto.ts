import { IsIn, IsOptional } from 'class-validator';

const ANALYTICS_RANGES = ['7d', '30d', '90d'] as const;
type AnalyticsRangeParam = (typeof ANALYTICS_RANGES)[number];

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(ANALYTICS_RANGES)
  range?: AnalyticsRangeParam;
}
