import { Button, Card, CardContent, CardHeader, CardTitle } from "@sahei/ui";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>SaHei</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Org dashboard scaffold — wired to @sahei/ui.
          </p>
          <Button>Get started</Button>
        </CardContent>
      </Card>
    </div>
  );
}
