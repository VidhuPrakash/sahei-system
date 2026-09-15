import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Manage Organization" };

export default function SettingsPage() {
  return <EmptyState description="Organization details, phone number, and team settings will live here." />;
}
