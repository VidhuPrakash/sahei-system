import { AppointmentStatus } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class AuthorityAppointmentsDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be an ISO date (YYYY-MM-DD)" })
  date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "from must be an ISO date (YYYY-MM-DD)" })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "to must be an ISO date (YYYY-MM-DD)" })
  to?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
