import { describe, expect, it } from "vitest";
import { boardMove } from "./board-moves";

describe("board column moves", () => {
  it("lets explicit PR board mode skip or reverse stages while retaining approved requests", () => {
    expect(boardMove("DRAFT", "APPROVED", "Review", undefined, true)).toEqual({
      action: "transition",
      status: "SOURCE_FACT_CHECK",
    });
    expect(boardMove("DRAFT", "APPROVED", "Scheduled", undefined, true)).toEqual({
      action: "schedule",
    });
    expect(boardMove("SCHEDULED", "APPROVED", "New request", undefined, true)).toEqual({
      action: "transition",
      status: "DRAFT",
    });
    expect(boardMove("DRAFT", "SUBMITTED", "Planning", undefined, true).action).toBe(
      "blocked",
    );
  });
  it.each(["Revision required", "Not proceeding", "unknown"])(
    "does not treat display-only %s as a review transition",
    (column) => {
      expect(
        boardMove(
          "IN_PRODUCTION",
          "APPROVED",
          column as Parameters<typeof boardMove>[2],
          "SOURCE_FACT_CHECK",
        ),
      ).toEqual({ action: "blocked", reason: "workflow" });
    },
  );
  it("moves approved intake work through planning and production", () => {
    expect(boardMove("DRAFT", "APPROVED", "Planning")).toEqual({
      action: "transition",
      status: "COMMUNICATION_PLANNING",
    });
    expect(boardMove("COMMUNICATION_PLANNING", "APPROVED", "In production")).toEqual({
      action: "transition",
      status: "IN_PRODUCTION",
    });
    expect(boardMove("REVISION_REQUIRED", "APPROVED", "In production")).toEqual({
      action: "transition",
      status: "IN_PRODUCTION",
    });
  });
  it("uses the configured review entry without bypassing approval stages", () => {
    expect(boardMove("IN_PRODUCTION", "APPROVED", "Review", "SOURCE_FACT_CHECK")).toEqual(
      { action: "transition", status: "SOURCE_FACT_CHECK" },
    );
    expect(
      boardMove("IN_PRODUCTION", "APPROVED", "Review", "PR_EDITORIAL_REVIEW"),
    ).toEqual({ action: "transition", status: "PR_EDITORIAL_REVIEW" });
    expect(boardMove("PR_EDITORIAL_REVIEW", "APPROVED", "Scheduled").action).toBe(
      "blocked",
    );
    expect(
      boardMove("SOURCE_FACT_CHECK", "APPROVED", "Review", "PR_EDITORIAL_REVIEW").action,
    ).toBe("blocked");
  });
  it("opens guarded scheduling for approved work only", () => {
    expect(boardMove("APPROVED", "APPROVED", "Scheduled")).toEqual({
      action: "schedule",
    });
    for (const state of ["DRAFT", "IN_PRODUCTION", "SCHEDULED", "CLOSED"] as const)
      expect(boardMove(state, "APPROVED", "Scheduled").action).toBe("blocked");
  });
  it("rejects missing policy, unapproved requests and skipped work stages", () => {
    expect(boardMove("DRAFT", "SUBMITTED", "Planning")).toEqual({
      action: "blocked",
      reason: "request",
    });
    expect(boardMove("IN_PRODUCTION", "APPROVED", "Review")).toEqual({
      action: "blocked",
      reason: "policy",
    });
    expect(boardMove("DRAFT", "APPROVED", "In production").action).toBe("blocked");
  });
});
