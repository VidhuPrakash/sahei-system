import { Module } from "@nestjs/common";
import { BusinessHoursService } from "./business-hours.service.js";

@Module({
  providers: [BusinessHoursService],
  exports: [BusinessHoursService],
})
export class BusinessHoursModule {}
