ALTER TABLE "PrTask"
ADD COLUMN "technicalReviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "managementApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PrTask"
SET "technicalReviewRequired" = true
WHERE "status" = 'TECHNICAL_REVIEW';

UPDATE "PrTask"
SET "managementApprovalRequired" = true
WHERE "status" = 'MANAGEMENT_APPROVAL';

ALTER TABLE "PrApproval"
ADD COLUMN "approvalPolicyVersion" TEXT,
ADD COLUMN "reviewChecklist" JSONB;

CREATE UNIQUE INDEX "PrSchedule_channel_publishedReference_key"
ON "PrSchedule"("channel", "publishedReference");
