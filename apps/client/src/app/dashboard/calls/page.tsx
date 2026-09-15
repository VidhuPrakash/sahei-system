import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Calls & Transcripts" };

export default function CallsPage() {
  return <EmptyState description="Calls your AI phone agent handles will show up here." />;
}
