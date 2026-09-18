-- AlterEnum
ALTER TYPE "phone_number_provisioning_status" ADD VALUE 'AWAITING_APPROVAL';

-- CreateTable
CREATE TABLE "phone_number_pricing" (
    "number_type" "phone_number_type" NOT NULL,
    "monthly_price_inr" DECIMAL(10,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_number_pricing_pkey" PRIMARY KEY ("number_type")
);

-- Seed defaults so pricing is queryable immediately; a future admin session
-- edits these rows directly rather than needing an upsert-on-first-write.
INSERT INTO "phone_number_pricing" ("number_type", "monthly_price_inr", "updated_at") VALUES
  ('MOBILE', 999.00, now()),
  ('LANDLINE', 599.00, now()),
  ('TOLLFREE', 1799.00, now());
