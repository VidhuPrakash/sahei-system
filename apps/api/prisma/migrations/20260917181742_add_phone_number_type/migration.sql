-- CreateEnum
CREATE TYPE "phone_number_type" AS ENUM ('MOBILE', 'LANDLINE', 'TOLLFREE');

-- AlterTable
ALTER TABLE "org_phone_numbers" ADD COLUMN     "monthly_price_inr" DECIMAL(10,2),
ADD COLUMN     "number_type" "phone_number_type";
