import { CallOutcome } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListCallTranscriptsQueryDto {
  @IsOptional()
  @IsEnum(CallOutcome)
  outcome?: CallOutcome;

  @IsOptional()
  @IsString()
  q?: string;
}
