import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../booking/api-key.guard.js";
import { AuthorityCallerService } from "./authority-caller.service.js";
import { AuthorityAppointmentsDto } from "./dto/authority-appointments.dto.js";
import { AuthorityLookupDto } from "./dto/authority-lookup.dto.js";

@Controller("authority")
@UseGuards(ApiKeyGuard)
export class AuthorityCallerController {
  constructor(private readonly authority: AuthorityCallerService) {}

  @Post("lookup")
  lookup(@Body() dto: AuthorityLookupDto) {
    return this.authority.lookup(dto);
  }

  @Post("appointments")
  appointments(@Body() dto: AuthorityAppointmentsDto) {
    return this.authority.listAppointments(dto);
  }
}
