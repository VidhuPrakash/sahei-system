import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export enum InquiryCategoryInput {
  BUSINESS_QUESTION = "business_question",
  OFF_TOPIC = "off_topic",
  NO_BOOKING_NEEDED = "no_booking_needed",
  OTHER = "other",
}

export class LogInquiryDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsEnum(InquiryCategoryInput)
  category!: InquiryCategoryInput;

  @IsString()
  @IsNotEmpty()
  summary!: string;
}
