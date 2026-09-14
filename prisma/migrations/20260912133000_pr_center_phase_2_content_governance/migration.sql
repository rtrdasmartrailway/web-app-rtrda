CREATE TYPE "PrContentIdeaStatus" AS ENUM ('PROPOSED', 'UNDER_REVIEW', 'ACCEPTED', 'CONVERTED', 'ARCHIVED');
CREATE TYPE "PrMessageHouseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED');

CREATE TABLE "PrContentIdea" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "proposerId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "audience" TEXT,
  "pillar" TEXT,
  "channel" TEXT,
  "priority" TEXT,
  "campaign" TEXT,
  "evidenceUrls" JSONB,
  "status" "PrContentIdeaStatus" NOT NULL DEFAULT 'PROPOSED',
  "reviewerId" UUID,
  "decisionReason" TEXT,
  "convertedRequestId" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrContentIdea_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrContentIdea_convertedRequestId_key" UNIQUE ("convertedRequestId"),
  CONSTRAINT "PrContentIdea_convertedRequestId_fkey" FOREIGN KEY ("convertedRequestId") REFERENCES "PrRequest"("id") ON DELETE RESTRICT
);

CREATE TABLE "PrMessageHouseVersion" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "PrMessageHouseStatus" NOT NULL DEFAULT 'DRAFT',
  "vision" TEXT NOT NULL,
  "positioning" TEXT NOT NULL,
  "pillars" JSONB NOT NULL,
  "foundation" TEXT NOT NULL,
  "sourceRationale" TEXT,
  "ownerId" UUID,
  "reviewerId" UUID,
  "approverId" UUID,
  "effectiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrMessageHouseVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrMessageHouseVersion_organizationId_versionNumber_key" UNIQUE ("organizationId", "versionNumber")
);

CREATE INDEX "PrContentIdea_organizationId_departmentId_status_createdAt_idx" ON "PrContentIdea"("organizationId", "departmentId", "status", "createdAt");
CREATE INDEX "PrContentIdea_proposerId_createdAt_idx" ON "PrContentIdea"("proposerId", "createdAt");
CREATE INDEX "PrMessageHouseVersion_organizationId_status_effectiveAt_idx" ON "PrMessageHouseVersion"("organizationId", "status", "effectiveAt");
