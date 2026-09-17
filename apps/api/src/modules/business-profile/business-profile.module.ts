import { Module } from "@nestjs/common";
import { BusinessHoursModule } from "../business-hours/business-hours.module.js";
import { BusinessProfileController } from "./business-profile.controller.js";
import { BusinessProfileService } from "./business-profile.service.js";

@Module({
  imports: [BusinessHoursModule],
  controllers: [BusinessProfileController],
  providers: [BusinessProfileService],
  exports: [BusinessProfileService],
})
export class BusinessProfileModule {}
