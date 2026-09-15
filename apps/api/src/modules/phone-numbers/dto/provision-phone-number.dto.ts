import { PhoneNumberSource } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export class ProvisionPhoneNumberDto {
  @IsEnum(PhoneNumberSource)
  source!: PhoneNumberSource;

  @ValidateIf((dto: ProvisionPhoneNumberDto) => dto.source === PhoneNumberSource.FORWARDED)
  @IsString()
  @IsNotEmpty()
  @Matches(E164_PATTERN, { message: 'forwardingFromNumber must be in E.164 format' })
  forwardingFromNumber?: string;
}
