import { IsNotEmpty, IsString, Matches } from "class-validator";

export class CheckAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  service!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be an ISO date (YYYY-MM-DD)" })
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be 24h HH:mm" })
  time!: string;
}
