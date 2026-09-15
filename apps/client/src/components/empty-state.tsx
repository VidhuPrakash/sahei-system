import { Card, CardContent, CardDescription, CardHeader } from "@sahei/ui";

export function EmptyState({ description }: { description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      </CardContent>
    </Card>
  );
}
