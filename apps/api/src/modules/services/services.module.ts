import { Module } from "@nestjs/common";
import { ServicesService } from "./services.service.js";

@Module({
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
