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
    expect(canTransitionTask("RTRDA_ALL_USER", "DRAFT", "COMMUNICATION_PLANNING")).toBe(
      false,
    );
    expect(canTransitionTask("RTRDA_PR", "DRAFT", "COMMUNICATION_PLANNING")).toBe(true);
    expect(canTransitionTask("RTRDA_BORD", "DRAFT", "COMMUNICATION_PLANNING")).toBe(true);
  });

  it("allows every new role to create requests", () => {
    expect(canCreateRequest("RTRDA_ALL_USER")).toBe(true);
    expect(canCreateRequest("RTRDA_PR")).toBe(true);
    expect(canCreateRequest("RTRDA_BORD")).toBe(true);
    expect(canCreateRequest("RTRDA_ADMIN")).toBe(true);
  });

  it("allows PR, BORD, and ADMIN to approve", () => {
    expect(canApprove("RTRDA_PR")).toBe(true);
    expect(canApprove("RTRDA_ADMIN")).toBe(true);
    expect(canApprove("RTRDA_BORD")).toBe(true);
    expect(canApprove("RTRDA_ALL_USER")).toBe(false);
  });

  it("allows PR, BORD, and ADMIN to read and decide requests", () => {
    expect(canReadAllRequests("RTRDA_PR")).toBe(true);
    expect(canReadAllRequests("RTRDA_BORD")).toBe(true);
    expect(canReadAllRequests("RTRDA_ADMIN")).toBe(true);
    expect(canReadAllRequests("RTRDA_ALL_USER")).toBe(false);
    expect(canDecideRequestIntake("RTRDA_PR")).toBe(true);
    expect(canDecideRequestIntake("RTRDA_BORD")).toBe(true);
    expect(canDecideRequestIntake("RTRDA_ADMIN")).toBe(true);
    expect(canDecideRequestIntake("RTRDA_ALL_USER")).toBe(false);
  });

  it("allows every role to propose ideas and PR/BORD/ADMIN to review", () => {
    for (const role of [
      "RTRDA_ALL_USER",
      "RTRDA_PR",
      "RTRDA_BORD",
      "RTRDA_ADMIN",
    ] as const)
      expect(canCreateIdea(role)).toBe(true);
    expect(canReviewIdeas("RTRDA_PR")).toBe(true);
    expect(canReviewIdeas("RTRDA_ADMIN")).toBe(true);
    expect(canReviewIdeas("RTRDA_BORD")).toBe(true);
    expect(canReviewIdeas("RTRDA_ALL_USER")).toBe(false);
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
    expect(canTransitionTask("RTRDA_PR", "APPROVED", "SCHEDULED")).toBe(false);
    expect(canTransitionTask("RTRDA_PR", "SCHEDULED", "PUBLISHED")).toBe(false);
  });

  it("allows all four roles to upload attachments", () => {
    expect(canAttachFiles("RTRDA_ALL_USER")).toBe(true);
    expect(canAttachFiles("RTRDA_PR")).toBe(true);
    expect(canAttachFiles("RTRDA_BORD")).toBe(true);
    expect(canAttachFiles("RTRDA_ADMIN")).toBe(true);
  });

  it("allows PR, BORD, and ADMIN to remove attachments", () => {
    expect(canRemoveAttachment("RTRDA_PR")).toBe(true);
    expect(canRemoveAttachment("RTRDA_ADMIN")).toBe(true);
    expect(canRemoveAttachment("RTRDA_ALL_USER")).toBe(false);
    expect(canRemoveAttachment("RTRDA_BORD")).toBe(true);
  });

  it("allows PR, BORD, and ADMIN to assign final assets", () => {
    expect(canAssignFinalAsset("RTRDA_PR")).toBe(true);
    expect(canAssignFinalAsset("RTRDA_ADMIN")).toBe(true);
    expect(canAssignFinalAsset("RTRDA_ALL_USER")).toBe(false);
    expect(canAssignFinalAsset("RTRDA_BORD")).toBe(true);
  });

  it("restricts access administration to RTRDA_ADMIN only", () => {
    expect(canManageAccess("RTRDA_ADMIN")).toBe(true);
    expect(canManageAccess("RTRDA_PR")).toBe(false);
    expect(canManageAccess("RTRDA_ALL_USER")).toBe(false);
    expect(canManageAccess("RTRDA_BORD")).toBe(false);
  });

  it("allows PR, BORD, and ADMIN to manage quarantine", () => {
    expect(canManageQuarantine("RTRDA_ADMIN")).toBe(true);
    expect(canManageQuarantine("RTRDA_PR")).toBe(true);
    expect(canManageQuarantine("RTRDA_ALL_USER")).toBe(false);
    expect(canManageQuarantine("RTRDA_BORD")).toBe(true);
  });

  it("restricts audit export to RTRDA_ADMIN only", () => {
    expect(canExportAudit("RTRDA_ADMIN")).toBe(true);
    expect(canExportAudit("RTRDA_PR")).toBe(false);
    expect(canExportAudit("RTRDA_ALL_USER")).toBe(false);
    expect(canExportAudit("RTRDA_BORD")).toBe(false);
  });

  it("restricts request restore to RTRDA_ADMIN only", () => {
    expect(canRestoreRequests("RTRDA_ADMIN")).toBe(true);
    expect(canRestoreRequests("RTRDA_PR")).toBe(false);
    expect(canRestoreRequests("RTRDA_ALL_USER")).toBe(false);
    expect(canRestoreRequests("RTRDA_BORD")).toBe(false);
  });
});
