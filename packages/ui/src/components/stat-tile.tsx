import * as React from "react";

import { Card, CardContent } from "./card";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  sublabel?: string;
}

const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ className, label, value, sublabel, ...props }, ref) => (
    <Card ref={ref} className={className} {...props}>
      <CardContent className="flex flex-col gap-1 p-6">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-4xl font-semibold tracking-tight text-foreground">{value}</span>
        {sublabel ? <span className="text-sm text-muted-foreground">{sublabel}</span> : null}
      </CardContent>
    </Card>
  )
);
StatTile.displayName = "StatTile";

export { StatTile };
