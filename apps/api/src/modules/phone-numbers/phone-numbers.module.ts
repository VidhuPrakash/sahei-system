import { Module } from '@nestjs/common';
import { BusinessProfileModule } from '../business-profile/business-profile.module.js';
import { ExotelModule } from '../exotel/exotel.module.js';
import { PhoneNumbersController } from './phone-numbers.controller.js';
import { PhoneNumbersService } from './phone-numbers.service.js';

@Module({
  imports: [ExotelModule, BusinessProfileModule],
  controllers: [PhoneNumbersController],
  providers: [PhoneNumbersService],
})
export class PhoneNumbersModule {}
