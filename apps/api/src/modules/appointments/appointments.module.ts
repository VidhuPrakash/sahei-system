import { Module } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service.js";

@Module({
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
