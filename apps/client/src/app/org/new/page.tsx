"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Headset, Phone, Smartphone, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { Button, Input, Label, RadioCard, Skeleton, Stepper } from "@sahei/ui";
import { PHONE_NUMBER_TYPES, PLAN_TIERS, type OnboardingStatus, type PhoneNumberPricing, type PhoneNumberType, type PlanTier } from "@sahei/types";

import { authClient } from "@/lib/auth-client";
import { apiClient, ApiError } from "@/lib/api-client";
import { AuthShell } from "@/components/auth-shell";
import { defaultBusinessHours } from "@/lib/business-hours";
import { BusinessDetailsFields, type BusinessDetails } from "@/components/business-details-fields";
import { AuthorityNumbersField, type AuthorityNumber } from "@/components/authority-numbers-field";

const STEPS = ["Business details", "Plan", "Phone number"];

const PLAN_COPY: Record<PlanTier, { label: string; description: string; icon: LucideIcon }> = {
  STARTER: {
    label: "Starter",
    description: "One phone number and core call handling and booking — for a single location finding its footing.",
    icon: Zap,
  },
  GROWTH: {
    label: "Growth",
    description: "Higher call volume with full analytics and priority support — for a business scaling up bookings.",
    icon: TrendingUp,
  },
  PRO: {
    label: "Pro",
    description: "Multiple locations and staff, with the most headroom for call volume — for an established business.",
    icon: Building2,
  },
};

const PLAN_PRICING: Record<PlanTier, number> = {
  STARTER: 1499,
  GROWTH: 2999,
  PRO: 5999,
};

const LINE_TYPE_COPY: Record<PhoneNumberType, { label: string; description: string; icon: LucideIcon }> = {
  MOBILE: {
    label: "Mobile",
    description: "A standard 10-digit mobile number.",
    icon: Smartphone,
  },
  LANDLINE: {
    label: "Landline",
    description: "A local landline number tied to your business's city code.",
    icon: Phone,
  },
  TOLLFREE: {
    label: "Toll-free",
    description: "A 1800 number callers can dial for free.",
    icon: Headset,
  },
};

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

function OnboardingStepSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<OnboardingStatus>("/organizations/me/onboarding-status")
      .then((status) => {
        if (cancelled) return;
        setHasOrganization(true);
        setPlanTier(status.plan.tier);
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
        <OnboardingStepSkeleton />
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
      {step === 2 && (
        <PlanStep
          onBack={() => setStep(1)}
          onComplete={(tier) => {
            setPlanTier(tier);
            setStep(3);
          }}
        />
      )}
      {step === 3 && (
        <PhoneNumberStep
          planTier={planTier}
          onBack={() => setStep(2)}
          onComplete={() => router.push("/dashboard")}
        />
      )}
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
  const [details, setDetails] = useState<BusinessDetails>({
    name: "",
    nameLocal: "",
    location: "",
    description: "",
    notes: "",
    businessHours: defaultBusinessHours(),
  });
  const [authorityNumbers, setAuthorityNumbers] = useState<AuthorityNumber[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!hasOrganization) {
        const { data: organization, error: createError } = await authClient.organization.create({
          name: details.name,
          slug: slugify(details.name),
        });
        if (createError || !organization) {
          setError(createError?.message ?? "Could not create your organization.");
          setIsSubmitting(false);
          return;
        }
        await authClient.organization.setActive({ organizationId: organization.id });
      }

      const authorityNumbersToSave = authorityNumbers.filter((row) => row.name.trim() || row.phoneNumber.trim());
      await apiClient.post("/business-profile", { ...details, authorityNumbers: authorityNumbersToSave });
      onComplete();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong saving your business details."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <BusinessDetailsFields value={details} onChange={setDetails} />
      <AuthorityNumbersField value={authorityNumbers} onChange={setAuthorityNumbers} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-2 h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function PlanStep({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (tier: PlanTier) => void;
}) {
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
      onComplete(selected);
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
            icon={PLAN_COPY[tier].icon}
            price={`₹${PLAN_PRICING[tier]}/mo`}
            recommended={tier === "GROWTH"}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={isSubmitting || !selected}>
          {isSubmitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

const FORWARDING_NUMBER_PATTERN = /^\+[1-9]\d{6,14}$/;

type PhoneSource = "NEW" | "FORWARDED";

interface PhoneNumberStatus {
  phoneNumber: string | null;
  source: PhoneSource;
  numberType: PhoneNumberType | null;
  monthlyPriceInr: number | null;
  provisioningStatus: "PENDING" | "AWAITING_APPROVAL" | "PURCHASED" | "FAILED";
  routingStatus: "PENDING" | "AUTO_CONFIGURED" | "MANUAL_SETUP_REQUIRED";
  lastError: string | null;
  forwardingInstructions: string | null;
  manualRoutingSetup: { wsUrl: string; instructions: string } | null;
}

function priceFor(pricing: PhoneNumberPricing[] | null, numberType: PhoneNumberType): number | null {
  return pricing?.find((row) => row.numberType === numberType)?.monthlyPriceInr ?? null;
}

type PhoneRequestStage = "form" | "paying" | "paid";

function PhoneNumberStep({
  planTier,
  onBack,
  onComplete,
}: {
  planTier: PlanTier | null;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<PhoneRequestStage>("form");
  const [source, setSource] = useState<PhoneSource>("NEW");
  const [forwardingFromNumber, setForwardingFromNumber] = useState("");
  const [numberType, setNumberType] = useState<PhoneNumberType | null>(null);
  const [pricing, setPricing] = useState<PhoneNumberPricing[] | null>(null);
  const [status, setStatus] = useState<PhoneNumberStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const numberPrice = numberType ? priceFor(pricing, numberType) : null;
  const planPrice = planTier ? PLAN_PRICING[planTier] : null;
  const totalPayable = planPrice != null && numberPrice != null ? planPrice + numberPrice : null;

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      apiClient.get<PhoneNumberStatus>("/phone-numbers/me"),
      apiClient.get<PhoneNumberPricing[]>("/phone-numbers/pricing"),
    ])
      .then(([existingResult, pricingResult]) => {
        if (cancelled) return;
        // existingResult rejects with 404 when nothing's provisioned yet — show the form.
        if (existingResult.status === "fulfilled") setStatus(existingResult.value);
        if (pricingResult.status === "fulfilled") setPricing(pricingResult.value);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleContinueFromForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!numberType) return;
    setError(null);

    if (source === "FORWARDED" && !FORWARDING_NUMBER_PATTERN.test(forwardingFromNumber)) {
      setError(
        "Enter your existing number in international format, starting with + and your country code (e.g. +919999999999)."
      );
      return;
    }

    setStage("paying");
  }

  function handlePay() {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStage("paid");
    }, 600);
  }

  async function handleConfirmRequest() {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await apiClient.post<PhoneNumberStatus>("/phone-numbers/provision", {
        source,
        forwardingFromNumber: source === "FORWARDED" ? forwardingFromNumber : undefined,
        numberType,
      });
      setStatus(result);
    } catch (err) {
      setError(errorMessage(err, "Could not send your request. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingExisting) {
    return <OnboardingStepSkeleton />;
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
        <Button type="button" className="h-11 w-full" onClick={onComplete}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (status?.provisioningStatus === "AWAITING_APPROVAL") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Request received</p>
          <p className="text-sm text-muted-foreground">
            We&apos;re setting up your {status.numberType ? LINE_TYPE_COPY[status.numberType].label : ""} number
            {status.monthlyPriceInr != null && ` (₹${status.monthlyPriceInr}/month, billed monthly)`}. Our team will
            activate it within 48 hours.
          </p>
        </div>
        <Button type="button" className="h-11 w-full" onClick={onComplete}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (stage === "paying") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-lg">
          <p className="text-sm text-muted-foreground">
            {source === "NEW" ? "New" : "Forwarded"} · {numberType ? LINE_TYPE_COPY[numberType].label : ""} number
          </p>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{planTier ? PLAN_COPY[planTier].label : "—"} plan</span>
            <span>{planPrice != null ? `₹${planPrice}/month` : "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{numberType ? LINE_TYPE_COPY[numberType].label : "—"} number</span>
            <span>{numberPrice != null ? `₹${numberPrice}/month` : "—"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm font-medium text-foreground">Total payable</span>
            <span className="text-lg font-semibold text-foreground">
              {totalPayable != null ? `₹${totalPayable}/month` : "—"}
            </span>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={() => setStage("form")}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button type="button" className="h-11 flex-1" onClick={handlePay} disabled={isSubmitting}>
            {isSubmitting ? "Processing…" : `Pay ₹${totalPayable ?? "—"} now`}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "paid") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Payment successful</p>
          <p className="text-sm text-muted-foreground">
            You paid {totalPayable != null ? `₹${totalPayable}/month` : "—"} for your{" "}
            {planTier ? PLAN_COPY[planTier].label : ""} plan and {numberType ? LINE_TYPE_COPY[numberType].label : ""}{" "}
            number. Continue to send your request to our team.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="button" className="h-11 w-full" onClick={handleConfirmRequest} disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Continue"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleContinueFromForm} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <RadioCard
          name="source"
          value="NEW"
          checked={source === "NEW"}
          onChange={() => {
            setSource("NEW");
            setError(null);
          }}
          label="Get a new number"
          description="We'll set up a number for your AI agent to answer on."
        />
        <RadioCard
          name="source"
          value="FORWARDED"
          checked={source === "FORWARDED"}
          onChange={() => {
            setSource("FORWARDED");
            setError(null);
          }}
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
          <p className="text-xs text-muted-foreground">
            International format, starting with + and your country code — e.g. +919999999999.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label>Select a number type</Label>
        <div className="flex flex-col gap-3">
          {PHONE_NUMBER_TYPES.map((type) => {
            const price = priceFor(pricing, type);
            return (
              <RadioCard
                key={type}
                name="numberType"
                value={type}
                checked={numberType === type}
                onChange={() => setNumberType(type)}
                label={LINE_TYPE_COPY[type].label}
                description={LINE_TYPE_COPY[type].description}
                icon={LINE_TYPE_COPY[type].icon}
                price={price != null ? `₹${price}/mo` : undefined}
              />
            );
          })}
        </div>
      </div>
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
      <div className="mt-2 flex gap-3">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={!numberType}>
          Continue
        </Button>
      </div>
    </form>
  );
}
