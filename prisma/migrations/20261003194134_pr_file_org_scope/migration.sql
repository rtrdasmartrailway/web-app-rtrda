ALTER TABLE "PrFileObject"
ADD COLUMN "organizationId" UUID;

WITH attachment_organizations AS (
  SELECT "fileId", MIN("organizationId"::text)::uuid AS "organizationId"
  FROM (
    SELECT a."fileId", r."organizationId"
    FROM "PrAttachment" a
    JOIN "PrRequest" r ON r."id" = a."requestId"
    WHERE a."requestId" IS NOT NULL

    UNION ALL

    SELECT a."fileId", r."organizationId"
    FROM "PrAttachment" a
    JOIN "PrTask" t ON t."id" = a."taskId"
    JOIN "PrRequest" r ON r."id" = t."requestId"
    WHERE a."taskId" IS NOT NULL
  ) linked
  GROUP BY "fileId"
  HAVING COUNT(DISTINCT "organizationId") = 1
)
UPDATE "PrFileObject" f
SET "organizationId" = linked."organizationId"
FROM attachment_organizations linked
WHERE linked."fileId" = f."id"
  AND f."organizationId" IS NULL;

ALTER TABLE "PrFileObject"
ADD CONSTRAINT "PrFileObject_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "PrOrganization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PrFileObject_organizationId_scanStatus_deletedAt_idx"
ON "PrFileObject"("organizationId", "scanStatus", "deletedAt");
