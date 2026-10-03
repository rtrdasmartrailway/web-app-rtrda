-- File lifecycle hardening: soft-delete support for orphan cleanup
ALTER TABLE "PrFileObject" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "PrFileObject_deletedAt_idx" ON "PrFileObject"("deletedAt");
