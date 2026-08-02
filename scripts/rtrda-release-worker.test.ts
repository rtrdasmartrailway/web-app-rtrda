import { describe, expect, it } from "vitest";
import {
  buildPromotionPlan,
  choosePromotionStrategy,
  evaluateAudit,
} from "./rtrda-release-worker.mjs";

const SHA_TEST = "a".repeat(40);
const SHA_PROD = "b".repeat(40);

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    testContainerSha: SHA_TEST,
    originTestSha: SHA_TEST,
    cloudGitSha: SHA_PROD,
    cloudMarkerSha: SHA_PROD,
    rtrda02GitSha: SHA_PROD,
    rtrda02MarkerSha: SHA_PROD,
    testHealth: true,
    cloudHealth: true,
    rtrda02Health: true,
    changedFiles: ["M\tsrc/example.ts"],
    ...overrides,
  };
}

describe("RTRDA release worker audit", () => {
  it("fails closed when the running test container has no deployed SHA label", () => {
    const report = evaluateAudit(evidence({ testContainerSha: "unknown" }));
    expect(report.promotable).toBe(false);
    expect(report.blockers).toContain("test_container_sha_unverified");
  });

  it("rejects unpushed code that was rebuilt manually on test", () => {
    const report = evaluateAudit(evidence({ originTestSha: "c".repeat(40) }));
    expect(report.promotable).toBe(false);
    expect(report.blockers).toContain("test_deploy_not_on_origin_test");
  });

  it("rejects production targets that are not on the same release", () => {
    const report = evaluateAudit(evidence({ rtrda02MarkerSha: "c".repeat(40) }));
    expect(report.promotable).toBe(false);
    expect(report.blockers).toContain("production_targets_not_in_parity");
  });

  it("reports an exact deployed test release as ready for promotion", () => {
    const report = evaluateAudit(evidence());
    expect(report.promotable).toBe(true);
    expect(report.test.sha).toBe(SHA_TEST);
    expect(report.production.sha).toBe(SHA_PROD);
    expect(report.changedFiles).toEqual(["M\tsrc/example.ts"]);
    expect(report.blockers).toEqual([]);
  });

  it("uses test directly only when the prospective merge preserves the tested tree", () => {
    expect(
      choosePromotionStrategy({
        approvedSha: SHA_TEST,
        testTree: "1".repeat(40),
        prospectiveTree: "1".repeat(40),
      }),
    ).toEqual({ mode: "direct-test", headBranch: "test" });
  });

  it("uses an exact-tree release branch when main and test topology diverged", () => {
    expect(
      choosePromotionStrategy({
        approvedSha: SHA_TEST,
        testTree: "1".repeat(40),
        prospectiveTree: "2".repeat(40),
      }),
    ).toEqual({
      mode: "exact-tree-release",
      headBranch: `release/exact-test-${SHA_TEST.slice(0, 12)}`,
    });
  });

  it("promotes through main CI instead of deploying production hosts directly", () => {
    const plan = buildPromotionPlan(SHA_TEST);
    expect(plan.join("\n")).toContain("gh pr merge");
    expect(plan.join("\n")).toContain("deploy-production.yml");
    expect(plan.join("\n")).not.toContain("ssh ");
  });
});
