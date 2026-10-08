CREATE TABLE "PrOrganizationSetting" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrOrganizationSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrOrganizationSetting_organizationId_key_key"
  ON "PrOrganizationSetting"("organizationId", "key");
CREATE INDEX "PrOrganizationSetting_organizationId_idx"
  ON "PrOrganizationSetting"("organizationId");

ALTER TABLE "PrOrganizationSetting"
  ADD CONSTRAINT "PrOrganizationSetting_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PrOrganization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
