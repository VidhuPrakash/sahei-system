import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Bookings & Calendar" };

export default function BookingsPage() {
  return <EmptyState description="Appointments booked by your AI phone agent will show up here." />;
}
