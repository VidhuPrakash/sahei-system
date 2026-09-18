"use client";

import { Input, Label, Textarea } from "@sahei/ui";

import { DAY_LABELS, minutesToTime, timeToMinutes, type BusinessHourRow } from "@/lib/business-hours";
import { CollapsibleSection } from "@/components/collapsible-section";

export interface BusinessDetails {
  name: string;
  nameLocal: string;
  location: string;
  description: string;
  notes: string;
  businessHours: BusinessHourRow[];
}

export function BusinessDetailsFields({
  value,
  onChange,
}: {
  value: BusinessDetails;
  onChange: (value: BusinessDetails) => void;
}) {
  function set<K extends keyof BusinessDetails>(key: K, fieldValue: BusinessDetails[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  function updateHour(dayOfWeek: number, field: "openTime" | "closeTime", timeValue: string) {
    set(
      "businessHours",
      value.businessHours.map((row) =>
        row.dayOfWeek === dayOfWeek ? { ...row, [field]: timeToMinutes(timeValue) } : row
      )
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-name">Business name</Label>
          <Input
            id="org-name"
            placeholder="e.g. Green Leaf Salon"
            required
            value={value.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-name-local">Business name (local language)</Label>
          <Input
            id="org-name-local"
            placeholder="e.g. ഗ്രീൻ ലീഫ് സലൂൺ"
            value={value.nameLocal}
            onChange={(event) => set("nameLocal", event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-location">Location</Label>
        <Input
          id="org-location"
          placeholder="e.g. MG Road, Kochi"
          value={value.location}
          onChange={(event) => set("location", event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-description">What does this business do?</Label>
          <Textarea
            id="org-description"
            placeholder="A short description your AI agent can use to answer questions about the business."
            value={value.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-notes">Notes for the agent</Label>
          <Textarea
            id="org-notes"
            placeholder="Parking, walk-ins, payment methods — anything callers commonly ask about."
            value={value.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </div>
      </div>
      <CollapsibleSection title="Business hours" defaultOpen>
        {value.businessHours.map((row) => (
          <div key={row.dayOfWeek} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm font-medium text-foreground sm:w-24 sm:shrink-0">
              {DAY_LABELS[row.dayOfWeek]}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`${DAY_LABELS[row.dayOfWeek]} opening time`}
                value={minutesToTime(row.openTime)}
                onChange={(event) => updateHour(row.dayOfWeek, "openTime", event.target.value)}
                className="min-w-0 flex-1 sm:w-28 sm:flex-none"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                aria-label={`${DAY_LABELS[row.dayOfWeek]} closing time`}
                value={minutesToTime(row.closeTime)}
                onChange={(event) => updateHour(row.dayOfWeek, "closeTime", event.target.value)}
                className="min-w-0 flex-1 sm:w-28 sm:flex-none"
              />
            </div>
          </div>
        ))}
      </CollapsibleSection>
    </>
  );
}
