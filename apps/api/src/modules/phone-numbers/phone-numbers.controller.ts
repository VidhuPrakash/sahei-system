import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentOrg } from '../../auth/current-org.decorator.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { ProvisionPhoneNumberDto } from './dto/provision-phone-number.dto.js';
import { PhoneNumbersService } from './phone-numbers.service.js';

@Controller('phone-numbers')
@UseGuards(SessionGuard)
export class PhoneNumbersController {
  constructor(private readonly phoneNumbers: PhoneNumbersService) {}

  @Post('provision')
  provision(@CurrentOrg() orgId: string, @Body() dto: ProvisionPhoneNumberDto) {
    return this.phoneNumbers.provision(orgId, dto);
  }

  @Get('me')
  getCurrent(@CurrentOrg() orgId: string) {
    return this.phoneNumbers.getStatusForOrg(orgId);
  }

  @Post('verify')
  verify(@CurrentOrg() orgId: string) {
    return this.phoneNumbers.verifyForwarding(orgId);
  }
}
