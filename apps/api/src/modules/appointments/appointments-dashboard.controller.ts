import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentOrg } from "../../auth/current-org.decorator.js";
import { SessionGuard } from "../../auth/session.guard.js";
import { AppointmentsService } from "./appointments.service.js";
import { ListAppointmentsQueryDto } from "./dto/list-appointments-query.dto.js";

@Controller("appointments")
@UseGuards(SessionGuard)
export class AppointmentsDashboardController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query() query: ListAppointmentsQueryDto) {
    return this.appointments.findByOrgId(orgId, query);
  }
}
