CREATE TABLE "PrUserDraft" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrUserDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrUserDraft_userId_kind_key"
  ON "PrUserDraft"("userId", "kind");
CREATE INDEX "PrUserDraft_organizationId_updatedAt_idx"
  ON "PrUserDraft"("organizationId", "updatedAt");

ALTER TABLE "PrUserDraft"
  ADD CONSTRAINT "PrUserDraft_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PrOrganization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrUserDraft"
  ADD CONSTRAINT "PrUserDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "PrCenterUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
