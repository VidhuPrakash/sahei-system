-- CreateTable
CREATE TABLE "org_phone_numbers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_phone_numbers_phone_number_key" ON "org_phone_numbers"("phone_number");

-- CreateIndex
CREATE INDEX "org_phone_numbers_org_id_idx" ON "org_phone_numbers"("org_id");

-- AddForeignKey
ALTER TABLE "org_phone_numbers" ADD CONSTRAINT "org_phone_numbers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
