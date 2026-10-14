ALTER TYPE "PrMessageHouseStatus" ADD VALUE 'REJECTED';
ALTER TABLE "PrMessageHouseVersion"
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "decisionReason" TEXT;
