"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LineChart,
  Skeleton,
  StatTile,
} from "@sahei/ui";
import { ANALYTICS_RANGES, type AnalyticsRange, type AnalyticsSummary, type InquiryCategory } from "@sahei/types";

import { apiClient, ApiError } from "@/lib/api-client";
import { EmptyState } from "@/components/empty-state";

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};

const THEME_LABELS: Record<InquiryCategory, string> = {
  BUSINESS_QUESTION: "Business question",
  OFF_TOPIC: "Off-topic",
  NO_BOOKING_NEEDED: "No booking needed",
  OTHER: "Other",
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function AnalyticsView() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => {
    setData(null);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const selectRange = useCallback((option: AnalyticsRange) => {
    setRange(option);
    setData(null);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<AnalyticsSummary>(`/analytics?range=${range}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load analytics. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [range, reloadToken]);

  const rangePicker = (
    <div className="flex items-center gap-2">
      {ANALYTICS_RANGES.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={option === range ? "default" : "outline"}
          onClick={() => selectRange(option)}
        >
          {RANGE_LABELS[option]}
        </Button>
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        {rangePicker}
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {rangePicker}

        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.conversion.totalCalls === 0) {
    return (
      <div className="flex flex-col gap-4">
        {rangePicker}
        <EmptyState description="Call and booking trends will show up here." />
      </div>
    );
  }

  const themeData = data.themes.map((theme) => ({ label: THEME_LABELS[theme.category], count: theme.count }));

  return (
    <div className="flex flex-col gap-4">
      {rangePicker}

      <StatTile
        label="Booking conversion"
        value={`${Math.round(data.conversion.conversionRate * 100)}%`}
        sublabel={`${data.conversion.booked} of ${data.conversion.totalCalls} calls booked`}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Call volume</CardTitle>
          <CardDescription>Calls answered per day, last {RANGE_LABELS[range]}.</CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart data={data.callVolume} formatDate={formatDate} valueLabel="calls" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Common query themes</CardTitle>
          <CardDescription>What callers who didn&apos;t book asked about.</CardDescription>
        </CardHeader>
        <CardContent>
          {themeData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inquiry themes recorded in this range.</p>
          ) : (
            <BarChart data={themeData} valueLabel="calls" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
