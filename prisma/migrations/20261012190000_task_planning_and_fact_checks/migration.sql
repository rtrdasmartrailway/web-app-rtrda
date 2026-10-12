CREATE TYPE "PrFactCheckResult" AS ENUM ('VERIFIED', 'NEEDS_CORRECTION', 'NEEDS_EVIDENCE');

ALTER TABLE "PrTask"
  ADD COLUMN "planningKeyMessage" TEXT;

CREATE TABLE "PrTaskFactCheck" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "taskRevision" INTEGER NOT NULL,
  "checkedById" UUID NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary" TEXT,
  CONSTRAINT "PrTaskFactCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrTaskFactCheckItem" (
  "id" UUID NOT NULL,
  "factCheckId" UUID NOT NULL,
  "claim" TEXT NOT NULL,
  "evidenceUrl" TEXT NOT NULL,
  "note" TEXT,
  "result" "PrFactCheckResult" NOT NULL,
  CONSTRAINT "PrTaskFactCheckItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrTaskFactCheck_taskId_taskRevision_checkedAt_idx"
  ON "PrTaskFactCheck"("taskId", "taskRevision", "checkedAt");
CREATE INDEX "PrTaskFactCheckItem_factCheckId_idx"
  ON "PrTaskFactCheckItem"("factCheckId");

ALTER TABLE "PrTaskFactCheck"
  ADD CONSTRAINT "PrTaskFactCheck_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrTaskFactCheck"
  ADD CONSTRAINT "PrTaskFactCheck_checkedById_fkey"
  FOREIGN KEY ("checkedById") REFERENCES "PrCenterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrTaskFactCheckItem"
  ADD CONSTRAINT "PrTaskFactCheckItem_factCheckId_fkey"
  FOREIGN KEY ("factCheckId") REFERENCES "PrTaskFactCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
