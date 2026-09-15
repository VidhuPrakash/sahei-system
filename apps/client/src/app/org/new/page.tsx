"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@sahei/ui";

import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth-shell";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: organization, error: createError } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });

    if (createError || !organization) {
      setError(createError?.message ?? "Could not create your organization.");
      setIsSubmitting(false);
      return;
    }

    await authClient.organization.setActive({ organizationId: organization.id });
    router.push("/dashboard");
  }

  return (
    <AuthShell>
      <div className="mb-8 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set up your organization</h1>
        <p className="text-sm text-muted-foreground">This is the business your AI phone agent answers for.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            placeholder="e.g. Green Leaf Salon"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating organization…" : "Create organization"}
        </Button>
      </form>
    </AuthShell>
  );
}
