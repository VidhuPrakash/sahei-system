import * as React from "react";

import { cn } from "../lib/utils";

export interface RadioCardProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

const RadioCard = React.forwardRef<HTMLInputElement, RadioCardProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-4 shadow-lg transition-colors has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          className
        )}
      >
        <input ref={ref} type="radio" id={inputId} className="sr-only" {...props} />
        <span className="text-sm font-semibold text-card-foreground">{label}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </label>
    );
  }
);
RadioCard.displayName = "RadioCard";

export { RadioCard };
