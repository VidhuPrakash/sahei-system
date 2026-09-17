import { PlanTier } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetPlanDto {
  @IsEnum(PlanTier)
  planTier!: PlanTier;
}
