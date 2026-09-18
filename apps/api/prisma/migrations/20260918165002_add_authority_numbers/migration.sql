-- CreateTable
CREATE TABLE "authority_numbers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authority_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authority_numbers_business_id_idx" ON "authority_numbers"("business_id");

-- AddForeignKey
ALTER TABLE "authority_numbers" ADD CONSTRAINT "authority_numbers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
