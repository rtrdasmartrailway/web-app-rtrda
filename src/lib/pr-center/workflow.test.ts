import { describe, expect, it } from "vitest";
import {
  canApprove,
  canCreateIdea,
  canReviewIdeas,
  canTransitionTask,
  canAttachFiles,
  canRemoveAttachment,
  canAssignFinalAsset,
  publicationGate,
} from "./workflow";

describe("PR Center workflow policy", () => {
  it("does not trust requester role to move a task", () => {
    expect(canTransitionTask("REQUESTER", "DRAFT", "COMMUNICATION_PLANNING")).toBe(false);
    expect(canTransitionTask("PR_OPERATIONS", "DRAFT", "COMMUNICATION_PLANNING")).toBe(
      true,
    );
  });

  it("limits approvals to approval authorities", () => {
    expect(canApprove("APPROVER")).toBe(true);
    expect(canApprove("EXECUTIVE_READ_ONLY")).toBe(false);
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
});
