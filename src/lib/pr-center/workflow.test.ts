import { describe, expect, it } from "vitest";
import { canApprove, canTransitionTask, publicationGate } from "./workflow";

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
