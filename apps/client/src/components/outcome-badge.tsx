import { cn } from "@sahei/ui";
import type { CallOutcome } from "@sahei/types";

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  BOOKED: "Booked",
  INQUIRY: "Inquiry",
  NO_OUTCOME: "No outcome",
};

const OUTCOME_STYLES: Record<CallOutcome, string> = {
  BOOKED: "bg-status-success/10 text-status-success",
  INQUIRY: "bg-primary/10 text-primary",
  NO_OUTCOME: "bg-status-warning/10 text-status-warning",
};

export function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        OUTCOME_STYLES[outcome]
      )}
    >
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}
