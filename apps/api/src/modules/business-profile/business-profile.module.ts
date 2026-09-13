import { Module } from "@nestjs/common";
import { BusinessProfileService } from "./business-profile.service.js";

@Module({
  providers: [BusinessProfileService],
  exports: [BusinessProfileService],
})
export class BusinessProfileModule {}
