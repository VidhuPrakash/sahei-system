import * as React from "react";
import { Check } from "lucide-react";
import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

const stepCircleVariants = cva(
  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
  {
    variants: {
      status: {
        complete: "border-primary bg-primary text-primary-foreground",
        active: "border-primary text-primary",
        upcoming: "border-input text-muted-foreground",
      },
    },
    defaultVariants: { status: "upcoming" },
  }
);

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  /** Ordered step labels. */
  steps: string[];
  /** 1-indexed — the step currently being filled in. */
  currentStep: number;
}

const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(
  ({ steps, currentStep, className, ...props }, ref) => (
    <ol ref={ref} className={cn("flex items-start", className)} {...props}>
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const status = stepNumber < currentStep ? "complete" : stepNumber === currentStep ? "active" : "upcoming";
        const isLast = index === steps.length - 1;

        return (
          <li
            key={label}
            aria-current={status === "active" ? "step" : undefined}
            className={cn("flex items-start", !isLast && "flex-1")}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span className={stepCircleVariants({ status })} aria-hidden="true">
                {status === "complete" ? <Check className="size-4" /> : stepNumber}
              </span>
              <span
                className={cn(
                  "text-xs font-medium text-nowrap",
                  status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn("mx-2 mt-4 h-px flex-1", status === "complete" ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  )
);
Stepper.displayName = "Stepper";

export { Stepper };
