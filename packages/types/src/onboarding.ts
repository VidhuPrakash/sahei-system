export const PLAN_TIERS = ["STARTER", "GROWTH", "PRO"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export type PhoneNumberProvisioningStatus = "PENDING" | "PURCHASED" | "FAILED";

export type OnboardingStep = "business-profile" | "plan" | "phone-number";

export interface OnboardingStatus {
  complete: boolean;
  nextStep: OnboardingStep | null;
  businessProfile: { complete: boolean };
  plan: { tier: PlanTier | null; selected: boolean };
  phoneNumber: { provisioningStatus: PhoneNumberProvisioningStatus | null; complete: boolean };
}
