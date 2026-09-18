import type { Metadata } from "next";
import { BookingsView } from "./bookings-view";

export const metadata: Metadata = { title: "Bookings & Calendar" };

export default function BookingsPage() {
  return <BookingsView />;
}
