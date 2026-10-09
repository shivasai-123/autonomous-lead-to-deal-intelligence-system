-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "recommendations_leadId_status_idx" ON "recommendations"("leadId", "status");
