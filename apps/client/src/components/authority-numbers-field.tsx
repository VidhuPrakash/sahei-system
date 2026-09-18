"use client";

import { Plus, X } from "lucide-react";
import { Button, Input } from "@sahei/ui";

import { CollapsibleSection } from "./collapsible-section";

export interface AuthorityNumber {
  name: string;
  phoneNumber: string;
}

export function AuthorityNumbersField({
  value,
  onChange,
}: {
  value: AuthorityNumber[];
  onChange: (rows: AuthorityNumber[]) => void;
}) {
  function updateRow(index: number, field: keyof AuthorityNumber, fieldValue: string) {
    onChange(value.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <CollapsibleSection title="Authority numbers">
      <p className="text-xs text-muted-foreground">
        Owners or managers who can call your support line to check on the account. Not active yet — coming in a
        future update.
      </p>
      {value.length > 0 && (
        <div className="flex flex-col gap-3">
          {value.map((row, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Name"
                aria-label={`Authority number ${index + 1} name`}
                value={row.name}
                onChange={(event) => updateRow(index, "name", event.target.value)}
                className="sm:w-40"
              />
              <Input
                type="tel"
                placeholder="+919999999999"
                aria-label={`Authority number ${index + 1} phone`}
                value={row.phoneNumber}
                onChange={(event) => updateRow(index, "phoneNumber", event.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove authority number ${index + 1}`}
                onClick={() => removeRow(index)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => onChange([...value, { name: "", phoneNumber: "" }])}
      >
        <Plus className="size-4" />
        Add number
      </Button>
    </CollapsibleSection>
  );
}
