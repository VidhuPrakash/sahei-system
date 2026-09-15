import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const SectionNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav ref={ref} className={cn("flex flex-col gap-1 pr-2", className)} {...props} />
  )
);
SectionNav.displayName = "SectionNav";

const sectionNavItemVariants = cva(
  "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-shell-muted-foreground outline-none transition-colors hover:bg-shell-accent hover:text-shell-foreground focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      active: {
        true: "bg-shell-accent font-semibold text-shell-foreground",
        false: "",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export interface SectionNavItemProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof sectionNavItemVariants> {
  asChild?: boolean;
}

const SectionNavItem = React.forwardRef<HTMLAnchorElement, SectionNavItemProps>(
  ({ className, active, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return (
      <Comp
        ref={ref}
        aria-current={active ? "page" : undefined}
        className={cn(sectionNavItemVariants({ active, className }))}
        {...props}
      />
    );
  }
);
SectionNavItem.displayName = "SectionNavItem";

export { SectionNav, SectionNavItem, sectionNavItemVariants };
