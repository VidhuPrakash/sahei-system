import { Injectable } from '@nestjs/common';
import { PhoneNumberProvisioningStatus, PlanTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BusinessProfileService } from '../business-profile/business-profile.service.js';

type OnboardingStep = 'business-profile' | 'plan' | 'phone-number';

export interface OnboardingStatusResponse {
  complete: boolean;
  nextStep: OnboardingStep | null;
  businessProfile: { complete: boolean };
  plan: { tier: PlanTier | null; selected: boolean };
  phoneNumber: { provisioningStatus: PhoneNumberProvisioningStatus | null; complete: boolean };
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessProfiles: BusinessProfileService,
  ) {}

  setPlan(orgId: string, planTier: PlanTier) {
    return this.prisma.organization.update({ where: { id: orgId }, data: { planTier } });
  }

  async getOnboardingStatus(orgId: string): Promise<OnboardingStatusResponse> {
    const [profile, organization, phoneNumber] = await Promise.all([
      this.businessProfiles.findByOrgId(orgId),
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      this.prisma.orgPhoneNumber.findFirst({ where: { orgId } }),
    ]);

    const businessProfileComplete = Boolean(profile?.name);
    const planSelected = organization.planTier !== null;
    const phoneNumberComplete = phoneNumber?.provisioningStatus === PhoneNumberProvisioningStatus.PURCHASED;

    const nextStep: OnboardingStep | null = !businessProfileComplete
      ? 'business-profile'
      : !planSelected
        ? 'plan'
        : !phoneNumberComplete
          ? 'phone-number'
          : null;

    return {
      complete: businessProfileComplete && planSelected && phoneNumberComplete,
      nextStep,
      businessProfile: { complete: businessProfileComplete },
      plan: { tier: organization.planTier, selected: planSelected },
      phoneNumber: {
        provisioningStatus: phoneNumber?.provisioningStatus ?? null,
        complete: phoneNumberComplete,
      },
    };
  }
}
