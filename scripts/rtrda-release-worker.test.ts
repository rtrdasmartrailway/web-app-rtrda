import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as releaseWorker from "./rtrda-release-worker.mjs";

const { buildPromotionPlan, evaluateAudit } = releaseWorker;

const workerSource = readFileSync(
  join(process.cwd(), "scripts/rtrda-release-worker.mjs"),
  "utf8",
);

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

  it("reuses the exact evidence emitted by a successful check", () => {
    const checkOutput = evaluateAudit(evidence());
    const promotionAudit = evaluateAudit(checkOutput);

    expect(promotionAudit.promotable).toBe(true);
    expect(promotionAudit.test.sha).toBe(SHA_TEST);
    expect(promotionAudit.production.sha).toBe(SHA_PROD);
  });

  it("atomically binds the merge to the approved test SHA", () => {
    const plan = buildPromotionPlan(SHA_TEST);

    expect(plan.join("\n")).toContain(`--match-head-commit ${SHA_TEST}`);
    expect(workerSource).toMatch(/"--match-head-commit",\s*approvedSha/);
  });

  it("selects both automatic and fallback production runs by the merged main SHA", () => {
    const selectorUses =
      workerSource.match(/selectProductionRunQuery\(mainSha\),/g) ?? [];

    expect(selectorUses).toHaveLength(2);
    expect(workerSource).not.toContain('".[0].databaseId"');
  });

  it("revalidates saved evidence against live state before any mutation", () => {
    const guard = (
      releaseWorker as typeof releaseWorker & {
        assertLivePromotionState?: (
          saved: ReturnType<typeof evaluateAudit>,
          live: ReturnType<typeof evaluateAudit>,
          approvedSha: string,
        ) => void;
      }
    ).assertLivePromotionState;

    expect(guard).toBeTypeOf("function");
    const saved = evaluateAudit(evidence());
    expect(() =>
      guard?.(saved, evaluateAudit(evidence({ cloudHealth: false })), SHA_TEST),
    ).toThrow(/live promotion state/i);
    expect(() =>
      guard?.(
        saved,
        evaluateAudit(
          evidence({
            cloudGitSha: "c".repeat(40),
            cloudMarkerSha: "c".repeat(40),
            rtrda02GitSha: "c".repeat(40),
            rtrda02MarkerSha: "c".repeat(40),
          }),
        ),
        SHA_TEST,
      ),
    ).toThrow(/production release changed/i);
    expect(workerSource).toContain(
      "assertLivePromotionState(report, liveReport, approvedSha)",
    );
  });

  it("promotes through main CI instead of deploying production hosts directly", () => {
    const plan = buildPromotionPlan(SHA_TEST);
    expect(plan.join("\n")).toContain("gh pr merge");
    expect(plan.join("\n")).toContain("deploy-production.yml");
    expect(plan.join("\n")).not.toContain("ssh ");
  });
});
