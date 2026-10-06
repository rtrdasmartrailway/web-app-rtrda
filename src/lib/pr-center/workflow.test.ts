import { describe, expect, it } from "vitest";
import {
  canApprove,
  canDecideRequestIntake,
  canReadAllRequests,
  canCreateIdea,
  canCreateRequest,
  canReviewIdeas,
  canTransitionTask,
  canAttachFiles,
  canRemoveAttachment,
  canAssignFinalAsset,
  canManageAccess,
  canManageQuarantine,
  canExportAudit,
  canRestoreRequests,
  publicationGate,
} from "./workflow";

describe("PR Center workflow policy", () => {
  it("does not trust requester role to move a task", () => {
    expect(canTransitionTask("REQUESTER", "DRAFT", "COMMUNICATION_PLANNING")).toBe(false);
    expect(canTransitionTask("PR_OPERATIONS", "DRAFT", "COMMUNICATION_PLANNING")).toBe(
      true,
    );
  });

  it("allows requesters to submit but does not grant submission authority to approval-only roles", () => {
    expect(canCreateRequest("REQUESTER")).toBe(true);
    expect(canCreateRequest("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canCreateRequest("PR_OPERATIONS")).toBe(false);
    expect(canCreateRequest("APPROVER")).toBe(false);
    expect(canCreateRequest("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("limits approvals to PR operations and scoped administrators", () => {
    expect(canApprove("PR_OPERATIONS")).toBe(true);
    expect(canApprove("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canApprove("APPROVER")).toBe(true);
    expect(canApprove("EXECUTIVE_READ_ONLY")).toBe(false);
    expect(canApprove("REQUESTER")).toBe(false);
  });

  it("restricts request visibility and intake decisions to PR Operations", () => {
    expect(canReadAllRequests("PR_OPERATIONS")).toBe(true);
    expect(canReadAllRequests("SCOPED_ADMINISTRATOR")).toBe(false);
    expect(canReadAllRequests("REQUESTER")).toBe(false);
    expect(canReadAllRequests("EXECUTIVE_READ_ONLY")).toBe(false);
    expect(canDecideRequestIntake("PR_OPERATIONS")).toBe(true);
    expect(canDecideRequestIntake("SCOPED_ADMINISTRATOR")).toBe(false);
    expect(canDecideRequestIntake("REQUESTER")).toBe(false);
  });

  it("allows idea proposals but restricts review and conversion authority", () => {
    expect(canCreateIdea("REQUESTER")).toBe(true);
    expect(canCreateIdea("EXECUTIVE_READ_ONLY")).toBe(false);
    expect(canReviewIdeas("PR_OPERATIONS")).toBe(true);
    expect(canReviewIdeas("REQUESTER")).toBe(false);
  });

  it("blocks publishing until every Phase 1 gate is complete", () => {
    expect(
      publicationGate({
        approved: false,
        ownerId: null,
        channel: null,
        hasSource: false,
        hasKeyMessage: false,
        hasCleanFinalAsset: false,
        scheduledFor: null,
      }),
    ).toEqual([
      "approved revision",
      "owner",
      "channel",
      "source",
      "key message",
      "clean final asset",
      "schedule",
    ]);
  });

  it("does not allow generic task transitions to schedule or publish", () => {
    expect(canTransitionTask("PR_OPERATIONS", "APPROVED", "SCHEDULED")).toBe(false);
    expect(canTransitionTask("PR_OPERATIONS", "SCHEDULED", "PUBLISHED")).toBe(false);
  });

  it("allows all roles except EXECUTIVE_READ_ONLY to attach files", () => {
    expect(canAttachFiles("REQUESTER")).toBe(true);
    expect(canAttachFiles("PR_OPERATIONS")).toBe(true);
    expect(canAttachFiles("APPROVER")).toBe(true);
    expect(canAttachFiles("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canAttachFiles("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("restricts attachment removal to PR_OPERATIONS and SCOPED_ADMINISTRATOR", () => {
    expect(canRemoveAttachment("PR_OPERATIONS")).toBe(true);
    expect(canRemoveAttachment("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canRemoveAttachment("REQUESTER")).toBe(false);
    expect(canRemoveAttachment("APPROVER")).toBe(false);
    expect(canRemoveAttachment("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("restricts final asset assignment to PR_OPERATIONS and SCOPED_ADMINISTRATOR", () => {
    expect(canAssignFinalAsset("PR_OPERATIONS")).toBe(true);
    expect(canAssignFinalAsset("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canAssignFinalAsset("REQUESTER")).toBe(false);
    expect(canAssignFinalAsset("APPROVER")).toBe(false);
    expect(canAssignFinalAsset("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("restricts access administration to SCOPED_ADMINISTRATOR only", () => {
    expect(canManageAccess("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canManageAccess("PR_OPERATIONS")).toBe(false);
    expect(canManageAccess("REQUESTER")).toBe(false);
    expect(canManageAccess("APPROVER")).toBe(false);
    expect(canManageAccess("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("allows SCOPED_ADMINISTRATOR and PR_OPERATIONS to manage quarantine", () => {
    expect(canManageQuarantine("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canManageQuarantine("PR_OPERATIONS")).toBe(true);
    expect(canManageQuarantine("REQUESTER")).toBe(false);
    expect(canManageQuarantine("APPROVER")).toBe(false);
    expect(canManageQuarantine("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("restricts audit export to SCOPED_ADMINISTRATOR only", () => {
    expect(canExportAudit("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canExportAudit("PR_OPERATIONS")).toBe(false);
    expect(canExportAudit("REQUESTER")).toBe(false);
    expect(canExportAudit("APPROVER")).toBe(false);
    expect(canExportAudit("EXECUTIVE_READ_ONLY")).toBe(false);
  });

  it("restricts request restore to SCOPED_ADMINISTRATOR only", () => {
    expect(canRestoreRequests("SCOPED_ADMINISTRATOR")).toBe(true);
    expect(canRestoreRequests("PR_OPERATIONS")).toBe(false);
    expect(canRestoreRequests("REQUESTER")).toBe(false);
    expect(canRestoreRequests("APPROVER")).toBe(false);
    expect(canRestoreRequests("EXECUTIVE_READ_ONLY")).toBe(false);
  });
});
