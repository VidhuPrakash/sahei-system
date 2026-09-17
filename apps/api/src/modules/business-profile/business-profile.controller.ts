import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentOrg } from '../../auth/current-org.decorator.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { BusinessHoursService } from '../business-hours/business-hours.service.js';
import { UpsertBusinessProfileDto } from './dto/upsert-business-profile.dto.js';
import { BusinessProfileService } from './business-profile.service.js';

@Controller('business-profile')
@UseGuards(SessionGuard)
export class BusinessProfileController {
  constructor(
    private readonly businessProfiles: BusinessProfileService,
    private readonly businessHours: BusinessHoursService,
  ) {}

  @Get('me')
  getCurrent(@CurrentOrg() orgId: string) {
    return this.businessProfiles.findByOrgId(orgId);
  }

  @Post()
  async upsert(@CurrentOrg() orgId: string, @Body() dto: UpsertBusinessProfileDto) {
    const existing = await this.businessProfiles.findByOrgId(orgId);
    const fields = {
      name: dto.name,
      nameLocal: dto.nameLocal,
      location: dto.location,
      description: dto.description,
      notes: dto.notes,
    };

    const profile = existing
      ? await this.businessProfiles.update(existing.id, fields)
      : await this.businessProfiles.create({ ...fields, organization: { connect: { id: orgId } } });

    if (dto.businessHours) {
      await Promise.all(
        dto.businessHours.map((entry) =>
          this.businessHours.upsertForDay(profile.id, entry.dayOfWeek, entry.openTime, entry.closeTime),
        ),
      );
    }

    return this.businessProfiles.findByOrgId(orgId);
  }
}
