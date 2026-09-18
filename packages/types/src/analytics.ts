export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const INQUIRY_CATEGORIES = ["BUSINESS_QUESTION", "OFF_TOPIC", "NO_BOOKING_NEEDED", "OTHER"] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export interface CallVolumePoint {
  date: string;
  count: number;
}

export interface ConversionStats {
  totalCalls: number;
  booked: number;
  conversionRate: number;
}

export interface QueryTheme {
  category: InquiryCategory;
  count: number;
}

export interface AnalyticsSummary {
  range: AnalyticsRange;
  callVolume: CallVolumePoint[];
  conversion: ConversionStats;
  themes: QueryTheme[];
}
