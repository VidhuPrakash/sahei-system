import { Module } from '@nestjs/common';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';

@Module({
  imports: [BusinessProfileModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
