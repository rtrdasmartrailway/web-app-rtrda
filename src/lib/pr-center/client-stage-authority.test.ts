import { describe, expect, it } from "vitest";
import type { ApprovalPolicy } from "./approval-policy";
import { canDecideTaskStage } from "./client-stage-authority";

const policy: ApprovalPolicy = {
  version: "fixture",
  approvalReference: "test only",
  effectiveAt: "2026-01-01T00:00:00Z",
  stages: [
    {
      status: "SOURCE_FACT_CHECK",
      required: true,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "TECHNICAL_REVIEW",
      required: true,
      roles: ["RTRDA_PR", "RTRDA_BORD"],
      departmentScope: "TASK_DEPARTMENT",
      condition: "TECHNICAL_REVIEW_REQUIRED",
    },
    {
      status: "PR_EDITORIAL_REVIEW",
      required: true,
      roles: ["RTRDA_PR"],
      departmentScope: "TASK_DEPARTMENT",
    },
    {
      status: "MANAGEMENT_APPROVAL",
      required: true,
      roles: ["RTRDA_BORD"],
      departmentScope: "TASK_DEPARTMENT",
      condition: "MANAGEMENT_APPROVAL_REQUIRED",
    },
  ],
};
const task = {
  status: "technical_review",
  departmentId: "a",
  technicalReviewRequired: true,
  managementApprovalRequired: true,
};
const admin = { role: "RTRDA_ADMIN", departmentId: null };

describe("client stage authority follows actual role grants and organization policy", () => {
  for (const stage of policy.stages) {
    it(`does not grant ADMIN an implicit ${stage.status} override`, () => {
      expect(canDecideTaskStage({ ...task, status: stage.status }, policy, [admin])).toBe(
        false,
      );
    });
  }
  it("allows mixed ADMIN/PR technical and editorial but not management", () => {
    const grants = [admin, { role: "RTRDA_PR", departmentId: "a" }];
    expect(canDecideTaskStage(task, policy, grants)).toBe(true);
    expect(
      canDecideTaskStage({ ...task, status: "pr_editorial_review" }, policy, grants),
    ).toBe(true);
    expect(
      canDecideTaskStage({ ...task, status: "management_approval" }, policy, grants),
    ).toBe(false);
  });
  it("allows mixed ADMIN/BORD technical and management but not editorial", () => {
    const grants = [admin, { role: "RTRDA_BORD", departmentId: "a" }];
    expect(canDecideTaskStage(task, policy, grants)).toBe(true);
    expect(
      canDecideTaskStage({ ...task, status: "management_approval" }, policy, grants),
    ).toBe(true);
    expect(
      canDecideTaskStage({ ...task, status: "pr_editorial_review" }, policy, grants),
    ).toBe(false);
  });
  it("does not widen scoped approvers through global ADMIN or unknown departments", () => {
    const grants = [admin, { role: "RTRDA_PR", departmentId: "b" }];
    expect(canDecideTaskStage(task, policy, grants)).toBe(false);
    expect(canDecideTaskStage({ ...task, departmentId: undefined }, policy, grants)).toBe(
      false,
    );
  });
  it("requires an eligible organization-wide grant for organization-only stages", () => {
    const orgPolicy: ApprovalPolicy = {
      ...policy,
      stages: policy.stages.map((s) => ({ ...s, departmentScope: "ORGANIZATION" })),
    };
    expect(
      canDecideTaskStage(task, orgPolicy, [
        admin,
        { role: "RTRDA_PR", departmentId: "a" },
      ]),
    ).toBe(false);
    expect(
      canDecideTaskStage(task, orgPolicy, [{ role: "RTRDA_PR", departmentId: null }]),
    ).toBe(true);
  });
  it("requires task conditions independently of role scope", () => {
    const grants = [{ role: "RTRDA_BORD", departmentId: null }];
    expect(
      canDecideTaskStage({ ...task, technicalReviewRequired: false }, policy, grants),
    ).toBe(false);
    expect(
      canDecideTaskStage(
        { ...task, status: "MANAGEMENT_APPROVAL", managementApprovalRequired: false },
        policy,
        grants,
      ),
    ).toBe(false);
  });
  it("fails closed with no policy, grants or applicable workflow stage", () => {
    expect(canDecideTaskStage(task, null, [admin])).toBe(false);
    expect(canDecideTaskStage(task, policy, undefined)).toBe(false);
    expect(
      canDecideTaskStage({ ...task, status: "IN_PRODUCTION" }, policy, [admin]),
    ).toBe(false);
  });
});
