import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { CurrentOrg } from "../../auth/current-org.decorator.js";
import { SessionGuard } from "../../auth/session.guard.js";
import { AppointmentsService } from "./appointments.service.js";
import { ListAppointmentsQueryDto } from "./dto/list-appointments-query.dto.js";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto.js";

@Controller("appointments")
@UseGuards(SessionGuard)
export class AppointmentsDashboardController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query() query: ListAppointmentsQueryDto) {
    return this.appointments.findByOrgId(orgId, query);
  }

  @Patch(":id/status")
  updateStatus(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() body: UpdateAppointmentStatusDto,
  ) {
    return this.appointments.updateStatusForOrg(orgId, id, body.status);
  }
}
