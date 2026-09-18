"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@sahei/ui";

import { apiClient, ApiError } from "@/lib/api-client";
import { defaultBusinessHours, type BusinessHourRow } from "@/lib/business-hours";
import { BusinessDetailsFields, type BusinessDetails } from "@/components/business-details-fields";
import { AuthorityNumbersField, type AuthorityNumber } from "@/components/authority-numbers-field";

interface BusinessProfileResponse {
  name: string;
  nameLocal: string | null;
  location: string | null;
  description: string | null;
  notes: string | null;
  businessHours: BusinessHourRow[];
  authorityNumbers: AuthorityNumber[];
}

function toDetails(profile: BusinessProfileResponse | null): BusinessDetails {
  return {
    name: profile?.name ?? "",
    nameLocal: profile?.nameLocal ?? "",
    location: profile?.location ?? "",
    description: profile?.description ?? "",
    notes: profile?.notes ?? "",
    businessHours: profile?.businessHours.length ? profile.businessHours : defaultBusinessHours(),
  };
}

function SettingsSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const [details, setDetails] = useState<BusinessDetails | null>(null);
  const [authorityNumbers, setAuthorityNumbers] = useState<AuthorityNumber[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProfile = useCallback(() => {
    apiClient
      .get<BusinessProfileResponse | null>("/business-profile/me")
      .then((profile) => {
        setDetails(toDetails(profile));
        setAuthorityNumbers(profile?.authorityNumbers ?? []);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Could not load your organization's details.");
      });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Leaving mid-edit (tab close/refresh, or an in-app nav link) would otherwise
  // discard changes silently — this is used in short, interruptible sessions.
  useEffect(() => {
    if (!isDirty) return;

    function warnOnUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function confirmOnLinkClick(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest("a");
      if (!link || link.origin !== window.location.origin) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        event.preventDefault();
      }
    }

    window.addEventListener("beforeunload", warnOnUnload);
    document.addEventListener("click", confirmOnLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      document.removeEventListener("click", confirmOnLinkClick, true);
    };
  }, [isDirty]);

  function updateDetails(next: BusinessDetails) {
    setDetails(next);
    setSaved(false);
    setIsDirty(true);
  }

  function updateAuthorityNumbers(next: AuthorityNumber[]) {
    setAuthorityNumbers(next);
    setSaved(false);
    setIsDirty(true);
  }

  async function saveProfile() {
    if (!details) return;
    setSaveError(null);
    setSaved(false);
    setIsSubmitting(true);

    try {
      const authorityNumbersToSave = authorityNumbers.filter((row) => row.name.trim() || row.phoneNumber.trim());
      await apiClient.post("/business-profile", { ...details, authorityNumbers: authorityNumbersToSave });
      setAuthorityNumbers(authorityNumbersToSave);
      setSaved(true);
      setIsDirty(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save your changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProfile();
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
        <Button type="button" variant="outline" onClick={loadProfile}>
          Try again
        </Button>
      </div>
    );
  }

  if (!details) {
    return <SettingsSkeleton />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle as="h2">Business details</CardTitle>
        <CardDescription>Shown to your AI phone agent and used to answer caller questions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <BusinessDetailsFields value={details} onChange={updateDetails} />
          <AuthorityNumbersField value={authorityNumbers} onChange={updateAuthorityNumbers} />
          {saveError && (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void saveProfile()}>
                Try again
              </Button>
            </div>
          )}
          {saved && (
            <p role="status" className="text-sm font-medium text-foreground">
              Saved.
            </p>
          )}
          <Button type="submit" className="mt-2 h-11 w-full sm:w-auto sm:self-start" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
