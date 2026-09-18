import { cn } from "@sahei/ui";
import type { AppointmentStatus } from "@sahei/types";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-status-success/10 text-status-success",
  COMPLETED: "bg-primary/10 text-primary",
  CANCELLED: "bg-status-danger/10 text-status-danger",
  NO_SHOW: "bg-status-warning/10 text-status-warning",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
