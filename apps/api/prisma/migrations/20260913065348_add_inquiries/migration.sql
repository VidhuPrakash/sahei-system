-- CreateEnum
CREATE TYPE "inquiry_category" AS ENUM ('BUSINESS_QUESTION', 'OFF_TOPIC', 'NO_BOOKING_NEEDED', 'OTHER');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category" "inquiry_category" NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_business_id_idx" ON "inquiries"("business_id");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
