import { describe, expect, it } from "vitest";
import {
  getApprovalStage,
  getFirstApprovalStage,
  getNextApprovalStage,
  hasApprovalAuthority,
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
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "TECHNICAL_REVIEW",
      required: false,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "PR_EDITORIAL_REVIEW",
      required: true,
      roles: ["RTRDA_ADMIN"],
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

  it("accepts RTRDA_BORD as an approval stage role", () => {
    const boardRolePolicy = {
      ...source,
      stages: [{ ...source.stages[0], roles: ["RTRDA_BORD"] }, ...source.stages.slice(1)],
    };
    expect(() => parseApprovalPolicy(JSON.stringify(boardRolePolicy))).not.toThrow();
  });

  it("does not resolve unconfigured or optional stages as valid current authority", () => {
    const policy = parseApprovalPolicy(JSON.stringify(source));
    expect(getApprovalStage(policy, "TECHNICAL_REVIEW")).toBeNull();
  });

  it("unions matching role grants while enforcing each grant's department scope", () => {
    const policy = parseApprovalPolicy(JSON.stringify(source));
    const departmentStage = getApprovalStage(policy, "SOURCE_FACT_CHECK")!;
    const organizationStage = getApprovalStage(policy, "PR_EDITORIAL_REVIEW")!;

    expect(
      hasApprovalAuthority({
        stage: departmentStage,
        roleGrants: [
          { role: "RTRDA_BORD", departmentId: "dept-2" },
          { role: "RTRDA_PR", departmentId: "dept-2" },
          { role: "RTRDA_PR", departmentId: "dept-3" },
        ],
        taskDepartmentId: "dept-2",
      }),
    ).toBe(true);
    expect(
      hasApprovalAuthority({
        stage: departmentStage,
        roleGrants: [{ role: "RTRDA_PR", departmentId: "dept-3" }],
        taskDepartmentId: "dept-2",
      }),
    ).toBe(false);
    expect(
      hasApprovalAuthority({
        stage: organizationStage,
        roleGrants: [{ role: "RTRDA_ADMIN", departmentId: "dept-2" }],
        taskDepartmentId: "dept-2",
      }),
    ).toBe(false);
    expect(
      hasApprovalAuthority({
        stage: organizationStage,
        roleGrants: [{ role: "RTRDA_ADMIN", departmentId: null }],
        taskDepartmentId: "dept-2",
      }),
    ).toBe(true);
  });
});
