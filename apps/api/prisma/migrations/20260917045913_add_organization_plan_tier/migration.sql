-- CreateEnum
CREATE TYPE "plan_tier" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "plan_tier" "plan_tier";
