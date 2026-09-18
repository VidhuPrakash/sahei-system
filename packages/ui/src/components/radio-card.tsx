import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";

export interface RadioCardProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  /** Lucide icon rendered next to the label — ties into the product's phone/network motif. */
  icon?: LucideIcon;
  /** Pre-formatted price string (e.g. "₹999/mo"), rendered as a prominent badge. */
  price?: string;
  /** Marks this card with a "Recommended" pill above the label. */
  recommended?: boolean;
}

const RadioCard = React.forwardRef<HTMLInputElement, RadioCardProps>(
  ({ className, label, description, icon: Icon, price, recommended, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 shadow-lg transition-colors has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          className
        )}
      >
        <input ref={ref} type="radio" id={inputId} className="sr-only" {...props} />
        {recommended && (
          <span className="inline-flex w-fit items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            Recommended
          </span>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            {Icon && <Icon className="size-5 text-primary" aria-hidden="true" />}
            {label}
          </span>
          {price && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
              {price}
            </span>
          )}
        </div>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </label>
    );
  }
);
RadioCard.displayName = "RadioCard";

export { RadioCard };
