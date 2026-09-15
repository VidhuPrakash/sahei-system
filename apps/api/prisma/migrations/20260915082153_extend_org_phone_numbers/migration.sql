-- CreateEnum
CREATE TYPE "phone_number_source" AS ENUM ('NEW', 'FORWARDED');

-- CreateEnum
CREATE TYPE "phone_number_provisioning_status" AS ENUM ('PENDING', 'PURCHASED', 'FAILED');

-- CreateEnum
CREATE TYPE "phone_number_routing_status" AS ENUM ('PENDING', 'AUTO_CONFIGURED', 'MANUAL_SETUP_REQUIRED');

-- AlterTable
ALTER TABLE "org_phone_numbers" ADD COLUMN     "exotel_flow_sid" TEXT,
ADD COLUMN     "exotel_phone_sid" TEXT,
ADD COLUMN     "forwarding_from_number" TEXT,
ADD COLUMN     "forwarding_verified_at" TIMESTAMP(3),
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "provisioning_status" "phone_number_provisioning_status" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "routing_status" "phone_number_routing_status" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "source" "phone_number_source" NOT NULL DEFAULT 'NEW',
-- Backfill default for any pre-existing rows; @updatedAt continues to set
-- this at the application layer for every write going forward.
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "verification_requested_at" TIMESTAMP(3),
ALTER COLUMN "phone_number" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "org_phone_numbers_exotel_phone_sid_key" ON "org_phone_numbers"("exotel_phone_sid");
