ALTER TABLE "PrOutboxEvent"
ADD COLUMN "lockedAt" TIMESTAMP(3);

CREATE INDEX "PrOutboxEvent_status_lockedAt_idx"
ON "PrOutboxEvent"("status", "lockedAt");
