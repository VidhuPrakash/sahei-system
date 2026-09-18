export const PHONE_NUMBER_TYPES = ["MOBILE", "LANDLINE", "TOLLFREE"] as const;
export type PhoneNumberType = (typeof PHONE_NUMBER_TYPES)[number];

export interface AvailablePhoneNumber {
  phoneNumber: string;
  numberType: PhoneNumberType;
  monthlyPriceInr: number;
  region?: string;
}

export interface PhoneNumberPricing {
  numberType: PhoneNumberType;
  monthlyPriceInr: number;
}
