"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "../lib/utils";

export interface LineChartPoint {
  date: string;
  count: number;
}

export interface LineChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: LineChartPoint[];
  formatDate?: (date: string) => string;
  valueLabel?: string;
}

interface TooltipContentProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number }>;
  formatDate?: (date: string) => string;
  valueLabel: string;
}

function TooltipContent({ active, label, payload, formatDate, valueLabel }: TooltipContentProps) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <div className="font-medium text-foreground">{formatDate ? formatDate(label) : label}</div>
      <div className="text-muted-foreground">
        {payload[0]?.value} {valueLabel}
      </div>
    </div>
  );
}

const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>(
  ({ className, data, formatDate, valueLabel = "calls", ...props }, ref) => (
    <div ref={ref} className={cn("h-64 w-full", className)} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={32}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            content={<TooltipContent formatDate={formatDate} valueLabel={valueLabel} />}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
);
LineChart.displayName = "LineChart";

export { LineChart };
