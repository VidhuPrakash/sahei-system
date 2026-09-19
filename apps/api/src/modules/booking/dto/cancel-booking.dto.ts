import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateHint must be an ISO date (YYYY-MM-DD)" })
  dateHint?: string;
}
