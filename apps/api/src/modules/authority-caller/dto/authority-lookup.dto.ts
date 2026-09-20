import { IsNotEmpty, IsString } from "class-validator";

export class AuthorityLookupDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}
