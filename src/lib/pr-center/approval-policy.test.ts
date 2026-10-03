import { describe, expect, it } from "vitest";
import {
  getApprovalStage,
  getFirstApprovalStage,
  getNextApprovalStage,
  parseApprovalPolicy,
  type ApprovalPolicy,
} from "./approval-policy";

const source: ApprovalPolicy = {
  version: "2026-01",
  approvalReference: "OWNER-DECISION-123",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  stages: [
    {
      status: "SOURCE_FACT_CHECK",
      required: true,
      roles: ["PR_OPERATIONS"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "TECHNICAL_REVIEW",
      required: false,
      roles: ["PR_OPERATIONS"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "PR_EDITORIAL_REVIEW",
      required: true,
      roles: ["SCOPED_ADMINISTRATOR"],
      departmentScope: "ORGANIZATION",
    },
  ],
};

describe("approval policy configuration", () => {
  it("fails closed when no approved policy is configured", () => {
    expect(() => parseApprovalPolicy(undefined)).toThrow(/not configured/i);
  });

  it("rejects policy without owner approval reference or valid stages", () => {
    expect(() =>
      parseApprovalPolicy(JSON.stringify({ ...source, approvalReference: "" })),
    ).toThrow();
    expect(() =>
      parseApprovalPolicy(JSON.stringify({ ...source, stages: [] })),
    ).toThrow();
  });

  it("parses a valid policy and moves only through required stages", () => {
    const policy = parseApprovalPolicy(JSON.stringify(source));
    expect(getFirstApprovalStage(policy).status).toBe("SOURCE_FACT_CHECK");
    expect(getNextApprovalStage(policy, "SOURCE_FACT_CHECK")?.status).toBe(
      "PR_EDITORIAL_REVIEW",
    );
    expect(getNextApprovalStage(policy, "PR_EDITORIAL_REVIEW")).toBeNull();
  });

  it("rejects legacy APPROVER role from stage authority", () => {
    const legacyRolePolicy = {
      ...source,
      stages: [{ ...source.stages[0], roles: ["APPROVER"] }, ...source.stages.slice(1)],
    };
    expect(() => parseApprovalPolicy(JSON.stringify(legacyRolePolicy))).toThrow(
      /valid approver roles/i,
    );
  });

  it("does not resolve unconfigured or optional stages as valid current authority", () => {
    const policy = parseApprovalPolicy(JSON.stringify(source));
    expect(getApprovalStage(policy, "TECHNICAL_REVIEW")).toBeNull();
  });
});
