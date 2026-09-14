CREATE TYPE "PrCenterRoleCode" AS ENUM ('REQUESTER', 'PR_OPERATIONS', 'APPROVER', 'EXECUTIVE_READ_ONLY', 'SCOPED_ADMINISTRATOR');
CREATE TYPE "PrRequestType" AS ENUM ('PR', 'OFFSITE');
CREATE TYPE "PrRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'WITHDRAWN', 'CANCELLED', 'CLOSED');
CREATE TYPE "PrTaskStatus" AS ENUM ('DRAFT', 'WAITING_FOR_INFORMATION', 'COMMUNICATION_PLANNING', 'IN_PRODUCTION', 'SOURCE_FACT_CHECK', 'TECHNICAL_REVIEW', 'PR_EDITORIAL_REVIEW', 'MANAGEMENT_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'CLOSED', 'REJECTED', 'CANCELLED');
CREATE TYPE "PrApprovalDecision" AS ENUM ('APPROVED', 'REVISION_REQUIRED', 'REJECTED', 'WITHDRAWN', 'REPLACED');
CREATE TYPE "PrFileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'QUARANTINED', 'FAILED');
CREATE TYPE "PrOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

CREATE TABLE "PrOrganization" (
  "id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrOrganization_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrOrganization_code_key" UNIQUE ("code")
);
CREATE TABLE "PrDepartment" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrDepartment_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrDepartment_organizationId_code_key" UNIQUE ("organizationId", "code"),
  CONSTRAINT "PrDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PrOrganization"("id") ON DELETE RESTRICT
);
CREATE TABLE "PrCenterUser" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "departmentId" UUID, "ssoSubject" TEXT NOT NULL,
  "email" TEXT NOT NULL, "displayName" TEXT NOT NULL, "position" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrCenterUser_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrCenterUser_ssoSubject_key" UNIQUE ("ssoSubject"), CONSTRAINT "PrCenterUser_email_key" UNIQUE ("email"),
  CONSTRAINT "PrCenterUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "PrCenterUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "PrDepartment"("id") ON DELETE SET NULL
);
CREATE TABLE "PrUserRole" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "role" "PrCenterRoleCode" NOT NULL, "organizationId" UUID NOT NULL, "departmentId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PrUserRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrUserRole_userId_role_organizationId_departmentId_key" UNIQUE ("userId", "role", "organizationId", "departmentId"),
  CONSTRAINT "PrUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PrCenterUser"("id") ON DELETE CASCADE
);
CREATE TABLE "PrRequest" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "departmentId" UUID NOT NULL, "requesterId" UUID NOT NULL,
  "requestNumber" TEXT NOT NULL, "type" "PrRequestType" NOT NULL, "status" "PrRequestStatus" NOT NULL DEFAULT 'DRAFT', "title" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL', "priorityReason" TEXT, "requestedFor" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrRequest_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrRequest_requestNumber_key" UNIQUE ("requestNumber"),
  CONSTRAINT "PrRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PrOrganization"("id") ON DELETE RESTRICT,
  CONSTRAINT "PrRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "PrDepartment"("id") ON DELETE RESTRICT,
  CONSTRAINT "PrRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "PrCenterUser"("id") ON DELETE RESTRICT
);
CREATE TABLE "PrRequestRevision" (
  "id" UUID NOT NULL, "requestId" UUID NOT NULL, "revisionNumber" INTEGER NOT NULL, "title" TEXT NOT NULL, "objective" TEXT,
  "audience" TEXT, "offsiteDetails" JSONB, "changeSummary" TEXT, "immutableAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrRequestRevision_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrRequestRevision_requestId_revisionNumber_key" UNIQUE ("requestId", "revisionNumber"),
  CONSTRAINT "PrRequestRevision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrRequest"("id") ON DELETE CASCADE
);
CREATE TABLE "PrRequestSource" (
  "id" UUID NOT NULL, "requestId" UUID NOT NULL, "url" TEXT NOT NULL, "label" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrRequestSource_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrRequestSource_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrRequest"("id") ON DELETE CASCADE
);
CREATE TABLE "PrTask" (
  "id" UUID NOT NULL, "requestId" UUID NOT NULL, "ownerId" UUID, "title" TEXT NOT NULL, "contentType" TEXT NOT NULL, "channel" TEXT,
  "status" "PrTaskStatus" NOT NULL DEFAULT 'DRAFT', "dueAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrTask_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "PrTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "PrCenterUser"("id") ON DELETE SET NULL
);
CREATE TABLE "PrTaskRevision" (
  "id" UUID NOT NULL, "taskId" UUID NOT NULL, "revisionNumber" INTEGER NOT NULL, "body" TEXT, "keyMessage" TEXT, "finalAssetId" UUID,
  "immutableAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrTaskRevision_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrTaskRevision_taskId_revisionNumber_key" UNIQUE ("taskId", "revisionNumber"),
  CONSTRAINT "PrTaskRevision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE
);
CREATE TABLE "PrApproval" (
  "id" UUID NOT NULL, "taskId" UUID NOT NULL, "taskRevision" INTEGER NOT NULL, "stage" TEXT NOT NULL, "decision" "PrApprovalDecision" NOT NULL,
  "comment" TEXT, "decidedById" UUID NOT NULL, "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrApproval_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE,
  CONSTRAINT "PrApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "PrCenterUser"("id") ON DELETE RESTRICT
);
CREATE TABLE "PrSchedule" (
  "id" UUID NOT NULL, "taskId" UUID NOT NULL, "channel" TEXT NOT NULL, "scheduledFor" TIMESTAMP(3) NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "publishedUrl" TEXT, "publishedReference" TEXT, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrSchedule_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrSchedule_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "PrSchedule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE
);
CREATE TABLE "PrFileObject" (
  "id" UUID NOT NULL, "storageKey" TEXT NOT NULL, "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "checksum" TEXT NOT NULL,
  "scanStatus" "PrFileScanStatus" NOT NULL DEFAULT 'PENDING', "scannedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrFileObject_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrFileObject_storageKey_key" UNIQUE ("storageKey")
);
CREATE TABLE "PrAttachment" (
  "id" UUID NOT NULL, "requestId" UUID, "taskId" UUID, "fileId" UUID NOT NULL, "kind" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PrAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "PrAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE,
  CONSTRAINT "PrAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PrFileObject"("id") ON DELETE RESTRICT,
  CONSTRAINT "PrAttachment_one_parent" CHECK (("requestId" IS NULL) <> ("taskId" IS NULL))
);
CREATE TABLE "PrComment" (
  "id" UUID NOT NULL, "requestId" UUID, "taskId" UUID, "authorId" UUID NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PrComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "PrComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE,
  CONSTRAINT "PrComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "PrCenterUser"("id") ON DELETE RESTRICT,
  CONSTRAINT "PrComment_one_parent" CHECK (("requestId" IS NULL) <> ("taskId" IS NULL))
);
CREATE TABLE "PrStatusHistory" (
  "id" UUID NOT NULL, "requestId" UUID, "taskId" UUID, "fromState" TEXT, "toState" TEXT NOT NULL, "reason" TEXT, "actorId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PrStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "PrStatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PrTask"("id") ON DELETE CASCADE,
  CONSTRAINT "PrStatusHistory_one_parent" CHECK (("requestId" IS NULL) <> ("taskId" IS NULL))
);
CREATE TABLE "PrNotification" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "target" TEXT, "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PrNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PrCenterUser"("id") ON DELETE CASCADE
);
CREATE TABLE "PrAuditEvent" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "actorId" UUID, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL, "before" JSONB, "after" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrAuditEvent_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "PrCenterUser"("id") ON DELETE SET NULL
);
CREATE TABLE "PrOutboxEvent" (
  "id" UUID NOT NULL, "aggregateType" TEXT NOT NULL, "aggregateId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "status" "PrOutboxStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrOutboxEvent_pkey" PRIMARY KEY ("id"), CONSTRAINT "PrOutboxEvent_idempotencyKey_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX "PrCenterUser_organizationId_departmentId_active_idx" ON "PrCenterUser"("organizationId", "departmentId", "active");
CREATE INDEX "PrUserRole_organizationId_departmentId_role_idx" ON "PrUserRole"("organizationId", "departmentId", "role");
CREATE INDEX "PrRequest_organizationId_departmentId_status_createdAt_idx" ON "PrRequest"("organizationId", "departmentId", "status", "createdAt");
CREATE INDEX "PrRequest_requesterId_createdAt_idx" ON "PrRequest"("requesterId", "createdAt");
CREATE INDEX "PrTask_requestId_status_idx" ON "PrTask"("requestId", "status");
CREATE INDEX "PrTask_ownerId_status_dueAt_idx" ON "PrTask"("ownerId", "status", "dueAt");
CREATE INDEX "PrApproval_taskId_taskRevision_stage_idx" ON "PrApproval"("taskId", "taskRevision", "stage");
CREATE INDEX "PrSchedule_channel_scheduledFor_idx" ON "PrSchedule"("channel", "scheduledFor");
CREATE INDEX "PrFileObject_scanStatus_idx" ON "PrFileObject"("scanStatus");
CREATE INDEX "PrAttachment_requestId_kind_idx" ON "PrAttachment"("requestId", "kind");
CREATE INDEX "PrAttachment_taskId_kind_idx" ON "PrAttachment"("taskId", "kind");
CREATE INDEX "PrNotification_userId_readAt_createdAt_idx" ON "PrNotification"("userId", "readAt", "createdAt");
CREATE INDEX "PrAuditEvent_organizationId_entityType_entityId_createdAt_idx" ON "PrAuditEvent"("organizationId", "entityType", "entityId", "createdAt");
CREATE INDEX "PrAuditEvent_correlationId_idx" ON "PrAuditEvent"("correlationId");
CREATE INDEX "PrOutboxEvent_status_availableAt_idx" ON "PrOutboxEvent"("status", "availableAt");
