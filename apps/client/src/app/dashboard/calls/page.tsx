import type { Metadata } from "next";
import { CallsView } from "./calls-view";

export const metadata: Metadata = { title: "Calls & Transcripts" };

export default function CallsPage() {
  return <CallsView />;
}
