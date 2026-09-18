import { Module } from "@nestjs/common";
import { AppointmentsDashboardController } from "./appointments-dashboard.controller.js";
import { AppointmentsService } from "./appointments.service.js";

@Module({
  controllers: [AppointmentsDashboardController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
