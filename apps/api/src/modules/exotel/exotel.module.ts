import { Module } from '@nestjs/common';
import { ExotelService } from './exotel.service.js';

@Module({
  providers: [ExotelService],
  exports: [ExotelService],
})
export class ExotelModule {}
