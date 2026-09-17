import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { BusinessProfileModule } from './modules/business-profile/business-profile.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { BusinessHoursModule } from './modules/business-hours/business-hours.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { BookingModule } from './modules/booking/booking.module.js';
import { CallTranscriptsModule } from './modules/call-transcripts/call-transcripts.module.js';
import { ExotelModule } from './modules/exotel/exotel.module.js';
import { PhoneNumbersModule } from './modules/phone-numbers/phone-numbers.module.js';
import { OrganizationModule } from './modules/organizations/organization.module.js';

@Module({
  imports: [
    PrismaModule,
    BusinessProfileModule,
    ServicesModule,
    BusinessHoursModule,
    AppointmentsModule,
    BookingModule,
    CallTranscriptsModule,
    ExotelModule,
    PhoneNumbersModule,
    OrganizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
