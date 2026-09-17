"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, RadioCard, Stepper, Textarea } from "@sahei/ui";
import { PLAN_TIERS, type OnboardingStatus, type PlanTier } from "@sahei/types";

import { authClient } from "@/lib/auth-client";
import { apiClient, ApiError } from "@/lib/api-client";
import { AuthShell } from "@/components/auth-shell";

const STEPS = ["Business details", "Plan", "Phone number"];

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PLAN_COPY: Record<PlanTier, { label: string; description: string }> = {
  STARTER: {
    label: "Starter",
    description: "One phone number and core call handling and booking — for a single location finding its footing.",
  },
  GROWTH: {
    label: "Growth",
    description: "Higher call volume with full analytics and priority support — for a business scaling up bookings.",
  },
  PRO: {
    label: "Pro",
    description: "Multiple locations and staff, with the most headroom for call volume — for an established business.",
  },
};

interface BusinessHourRow {
  dayOfWeek: number;
  openTime: number;
  closeTime: number;
}

function defaultBusinessHours(): BusinessHourRow[] {
  return DAY_LABELS.map((_, dayOfWeek) => ({ dayOfWeek, openTime: 9 * 60, closeTime: 18 * 60 }));
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function timeToMinutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<OnboardingStatus>("/organizations/me/onboarding-status")
      .then((status) => {
        if (cancelled) return;
        setHasOrganization(true);
        if (status.complete) {
          router.replace("/dashboard");
          return;
        }
        setStep(status.nextStep === "plan" ? 2 : status.nextStep === "phone-number" ? 3 : 1);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setHasOrganization(false);
          setStep(1);
        } else {
          setStatusError("Could not load your organization's setup status. Please refresh and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingStatus) {
    return (
      <AuthShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AuthShell>
    );
  }

  if (statusError) {
    return (
      <AuthShell>
        <p role="alert" className="text-sm text-destructive">
          {statusError}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell className="max-w-lg">
      <div className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set up your organization</h1>
          <p className="text-sm text-muted-foreground">This is the business your AI phone agent answers for.</p>
        </div>
        <Stepper steps={STEPS} currentStep={step} />
      </div>
      {step === 1 && (
        <BusinessDetailsStep
          hasOrganization={hasOrganization}
          onComplete={() => {
            setHasOrganization(true);
            setStep(2);
          }}
        />
      )}
      {step === 2 && <PlanStep onComplete={() => setStep(3)} />}
      {step === 3 && <PhoneNumberStep onComplete={() => router.push("/dashboard")} />}
    </AuthShell>
  );
}

function BusinessDetailsStep({
  hasOrganization,
  onComplete,
}: {
  hasOrganization: boolean;
  onComplete: () => void;
}) {
  const [name, setName] = useState("");
  const [nameLocal, setNameLocal] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHourRow[]>(defaultBusinessHours);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateHour(dayOfWeek: number, field: "openTime" | "closeTime", value: string) {
    setBusinessHours((rows) =>
      rows.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, [field]: timeToMinutes(value) } : row))
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!hasOrganization) {
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
      }

      await apiClient.post("/business-profile", { name, nameLocal, location, description, notes, businessHours });
      onComplete();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong saving your business details."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-name">Business name</Label>
        <Input
          id="org-name"
          placeholder="e.g. Green Leaf Salon"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-name-local">Business name (local language)</Label>
        <Input
          id="org-name-local"
          placeholder="e.g. ഗ്രീൻ ലീഫ് സലൂൺ"
          value={nameLocal}
          onChange={(event) => setNameLocal(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-location">Location</Label>
        <Input
          id="org-location"
          placeholder="e.g. MG Road, Kochi"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-description">What does this business do?</Label>
        <Textarea
          id="org-description"
          placeholder="A short description your AI agent can use to answer questions about the business."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org-notes">Notes for the agent</Label>
        <Textarea
          id="org-notes"
          placeholder="Parking, walk-ins, payment methods — anything callers commonly ask about."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Business hours</Label>
        <div className="flex flex-col gap-3 rounded-md border border-input bg-background p-3">
          {businessHours.map((row) => (
            <div key={row.dayOfWeek} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-sm font-medium text-foreground sm:w-24 sm:shrink-0">
                {DAY_LABELS[row.dayOfWeek]}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${DAY_LABELS[row.dayOfWeek]} opening time`}
                  value={minutesToTime(row.openTime)}
                  onChange={(event) => updateHour(row.dayOfWeek, "openTime", event.target.value)}
                  className="min-w-0 flex-1 sm:w-28 sm:flex-none"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  aria-label={`${DAY_LABELS[row.dayOfWeek]} closing time`}
                  value={minutesToTime(row.closeTime)}
                  onChange={(event) => updateHour(row.dayOfWeek, "closeTime", event.target.value)}
                  className="min-w-0 flex-1 sm:w-28 sm:flex-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function PlanStep({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post("/organizations/me/plan", { planTier: selected });
      onComplete();
    } catch (err) {
      setError(errorMessage(err, "Could not save your plan selection."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {PLAN_TIERS.map((tier) => (
          <RadioCard
            key={tier}
            name="planTier"
            value={tier}
            checked={selected === tier}
            onChange={() => setSelected(tier)}
            label={PLAN_COPY[tier].label}
            description={PLAN_COPY[tier].description}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting || !selected}>
        {isSubmitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

type PhoneSource = "NEW" | "FORWARDED";

interface PhoneNumberStatus {
  phoneNumber: string | null;
  source: PhoneSource;
  provisioningStatus: "PENDING" | "PURCHASED" | "FAILED";
  routingStatus: "PENDING" | "AUTO_CONFIGURED" | "MANUAL_SETUP_REQUIRED";
  lastError: string | null;
  forwardingInstructions: string | null;
  manualRoutingSetup: { wsUrl: string; instructions: string } | null;
}

function PhoneNumberStep({ onComplete }: { onComplete: () => void }) {
  const [source, setSource] = useState<PhoneSource>("NEW");
  const [forwardingFromNumber, setForwardingFromNumber] = useState("");
  const [status, setStatus] = useState<PhoneNumberStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<PhoneNumberStatus>("/phone-numbers/me")
      .then((existing) => {
        if (!cancelled) setStatus(existing);
      })
      .catch(() => {
        // 404 — nothing provisioned yet, show the form.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await apiClient.post<PhoneNumberStatus>("/phone-numbers/provision", {
        source,
        forwardingFromNumber: source === "FORWARDED" ? forwardingFromNumber : undefined,
      });
      setStatus(result);
    } catch (err) {
      setError(errorMessage(err, "Could not set up your phone number. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingExisting) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (status?.provisioningStatus === "PURCHASED") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Your SaHei number: {status.phoneNumber}</p>
          <p className="text-sm text-muted-foreground">Callers can already reach your AI agent on this number.</p>
        </div>
        {status.forwardingInstructions && (
          <p className="whitespace-pre-line rounded-md border border-input bg-background p-3 text-sm text-foreground">
            {status.forwardingInstructions}
          </p>
        )}
        {status.manualRoutingSetup && (
          <p className="whitespace-pre-line rounded-md border border-input bg-background p-3 text-sm text-foreground">
            {status.manualRoutingSetup.instructions}
          </p>
        )}
        <Button type="button" className="w-full" onClick={onComplete}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <RadioCard
          name="source"
          value="NEW"
          checked={source === "NEW"}
          onChange={() => setSource("NEW")}
          label="Get a new number"
          description="We'll purchase a number for your AI agent to answer on."
        />
        <RadioCard
          name="source"
          value="FORWARDED"
          checked={source === "FORWARDED"}
          onChange={() => setSource("FORWARDED")}
          label="Forward my existing number"
          description="Keep your current number and forward calls to your new SaHei number."
        />
      </div>
      {source === "FORWARDED" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forwarding-number">Your existing number</Label>
          <Input
            id="forwarding-number"
            placeholder="+919999999999"
            required
            value={forwardingFromNumber}
            onChange={(event) => setForwardingFromNumber(event.target.value)}
          />
        </div>
      )}
      {status?.provisioningStatus === "FAILED" && status.lastError && (
        <p role="alert" className="text-sm text-destructive">
          {status.lastError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Setting up your number…" : "Set up phone number"}
      </Button>
    </form>
  );
}
