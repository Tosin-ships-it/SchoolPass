-- AlterTable: Add account deletion lifecycle columns to parents table
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "scheduledDeletionAt" TIMESTAMP(3);
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "parents_scheduledDeletionAt_idx" ON "parents"("scheduledDeletionAt");
CREATE INDEX IF NOT EXISTS "parents_isLocked_idx" ON "parents"("isLocked");

-- AlterTable: Restrict foreign key deletion on payments to protect 6-year CAMA financial ledger
-- Drop old cascading foreign key constraint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_parentId_fkey";

-- Add new RESTRICT foreign key constraint
ALTER TABLE "payments" ADD CONSTRAINT "payments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
