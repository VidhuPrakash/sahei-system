import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentOrg } from '../../auth/current-org.decorator.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { SetPlanDto } from './dto/set-plan.dto.js';
import { OrganizationService } from './organization.service.js';

@Controller('organizations/me')
@UseGuards(SessionGuard)
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get('onboarding-status')
  getOnboardingStatus(@CurrentOrg() orgId: string) {
    return this.organizations.getOnboardingStatus(orgId);
  }

  @Post('plan')
  setPlan(@CurrentOrg() orgId: string, @Body() dto: SetPlanDto) {
    return this.organizations.setPlan(orgId, dto.planTier);
  }
}
