import { IsNotEmpty, IsString } from 'class-validator';
import { CheckAvailabilityDto } from './check-availability.dto.js';

export class BookAppointmentDto extends CheckAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerArea!: string;
}