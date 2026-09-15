import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <EmptyState description="Call and booking trends will show up here." />;
}
