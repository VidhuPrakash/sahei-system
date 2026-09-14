-- CreateEnum
CREATE TYPE "call_outcome" AS ENUM ('BOOKED', 'INQUIRY', 'NO_OUTCOME');

-- CreateTable
CREATE TABLE "call_transcripts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "outcome" "call_outcome" NOT NULL,
    "booking_reference" TEXT,
    "transcript" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_transcripts_call_id_key" ON "call_transcripts"("call_id");

-- CreateIndex
CREATE INDEX "call_transcripts_business_id_idx" ON "call_transcripts"("business_id");

-- AddForeignKey
ALTER TABLE "call_transcripts" ADD CONSTRAINT "call_transcripts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
