import { describe, expect, it } from "vitest";
import {
  canApprove,
  canCreateIdea,
  canReviewIdeas,
  canTransitionTask,
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
});
