import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module.js";
import { BusinessHoursModule } from "../business-hours/business-hours.module.js";
import { BusinessProfileModule } from "../business-profile/business-profile.module.js";
import { ServicesModule } from "../services/services.module.js";
import { BookingController } from "./booking.controller.js";
import { BookingService } from "./booking.service.js";

@Module({
  imports: [BusinessProfileModule, ServicesModule, BusinessHoursModule, AppointmentsModule],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
