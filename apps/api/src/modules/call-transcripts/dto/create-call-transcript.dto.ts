import { CallOutcome } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCallTranscriptDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  callId!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @IsOptional()
  @IsString()
  bookingReference?: string;

  @IsArray()
  transcript!: Record<string, unknown>[];

  @IsISO8601()
  startedAt!: string;

  @IsISO8601()
  endedAt!: string;
}
