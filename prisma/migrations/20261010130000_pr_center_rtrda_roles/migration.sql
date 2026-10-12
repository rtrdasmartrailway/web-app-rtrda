CREATE TYPE "PrCenterRoleCode_new" AS ENUM (
  'RTRDA_ALL_USER',
  'RTRDA_PR',
  'RTRDA_BORD',
  'RTRDA_ADMIN'
);

-- The legacy APPROVER and EXECUTIVE_READ_ONLY grants both map to RTRDA_BORD.
-- Remove duplicate grants that would otherwise violate the existing unique key.
WITH mapped_grants AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY
        "userId",
        CASE "role"::text
          WHEN 'REQUESTER' THEN 'RTRDA_ALL_USER'
          WHEN 'PR_OPERATIONS' THEN 'RTRDA_PR'
          WHEN 'APPROVER' THEN 'RTRDA_BORD'
          WHEN 'EXECUTIVE_READ_ONLY' THEN 'RTRDA_BORD'
          WHEN 'SCOPED_ADMINISTRATOR' THEN 'RTRDA_ADMIN'
        END,
        "organizationId",
        "departmentId"
      ORDER BY "createdAt", "id"
    ) AS grant_number
  FROM "PrUserRole"
)
DELETE FROM "PrUserRole"
WHERE "id" IN (SELECT "id" FROM mapped_grants WHERE grant_number > 1);

ALTER TABLE "PrUserRole"
  ALTER COLUMN "role" TYPE "PrCenterRoleCode_new"
  USING (
    CASE "role"::text
      WHEN 'REQUESTER' THEN 'RTRDA_ALL_USER'
      WHEN 'PR_OPERATIONS' THEN 'RTRDA_PR'
      WHEN 'APPROVER' THEN 'RTRDA_BORD'
      WHEN 'EXECUTIVE_READ_ONLY' THEN 'RTRDA_BORD'
      WHEN 'SCOPED_ADMINISTRATOR' THEN 'RTRDA_ADMIN'
    END
  )::"PrCenterRoleCode_new";

DROP TYPE "PrCenterRoleCode";
ALTER TYPE "PrCenterRoleCode_new" RENAME TO "PrCenterRoleCode";
