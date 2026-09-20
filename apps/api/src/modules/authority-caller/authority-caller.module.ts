import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module.js";
import { AuthorityCallerController } from "./authority-caller.controller.js";
import { AuthorityCallerService } from "./authority-caller.service.js";

@Module({
  imports: [AppointmentsModule],
  controllers: [AuthorityCallerController],
  providers: [AuthorityCallerService],
})
export class AuthorityCallerModule {}
