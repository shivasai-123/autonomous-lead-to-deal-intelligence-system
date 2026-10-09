-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspiciousReason" TEXT;

-- CreateIndex
CREATE INDEX "leads_isArchived_idx" ON "leads"("isArchived");
