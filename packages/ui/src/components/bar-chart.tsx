"use client";

import * as React from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "../lib/utils";

export interface BarChartPoint {
  label: string;
  count: number;
}

export interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: BarChartPoint[];
  valueLabel?: string;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: Array<{ payload: BarChartPoint }>;
  valueLabel: string;
}

function TooltipContent({ active, payload, valueLabel }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <div className="font-medium text-foreground">{point.label}</div>
      <div className="text-muted-foreground">
        {point.count} {valueLabel}
      </div>
    </div>
  );
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  ({ className, data, valueLabel = "calls", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-full", className)}
      style={{ height: Math.max(data.length * 44, 120) }}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={140}
            tick={{ fill: "var(--color-foreground)", fontSize: 13 }}
          />
          <Tooltip cursor={{ fill: "var(--color-accent)" }} content={<TooltipContent valueLabel={valueLabel} />} />
          <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={28} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
);
BarChart.displayName = "BarChart";

export { BarChart };
