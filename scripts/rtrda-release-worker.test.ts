import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
    testPublicHealth: true,
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

  it("rejects a publicly unreachable Test release", () => {
    const report = evaluateAudit(evidence({ testPublicHealth: false }));
    expect(report.promotable).toBe(false);
    expect(report.blockers).toContain("test_public_unhealthy");
    expect(workerSource).toContain('"https://test.rtrda.or.th/healthz"');
  });

  it("turns an unreachable production target into empty audit evidence", () => {
    const reader = (
      releaseWorker as typeof releaseWorker & {
        readRemoteEvidence?: (
          key: string,
          destination: string,
          path: string,
          runner: () => string,
        ) => { git: string; marker: string };
      }
    ).readRemoteEvidence;

    expect(reader).toBeTypeOf("function");
    expect(
      reader?.("/tmp/key", "host", "/app", () => {
        throw new Error("unreachable");
      }),
    ).toEqual({ git: "", marker: "" });
    expect(
      evaluateAudit(
        evidence({
          cloudGitSha: "",
          cloudMarkerSha: "",
          cloudHealth: false,
        }),
      ).blockers,
    ).toEqual(expect.arrayContaining(["cloud_release_unverified", "cloud_unhealthy"]));
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

  it("atomically fast-forwards main from the audited base to the verified merge", () => {
    const plan = buildPromotionPlan(SHA_TEST);

    expect(plan.join("\n")).toContain(`release/exact-${SHA_TEST}`);
    expect(plan.join("\n")).toContain("atomic fast-forward");
    expect(workerSource).toContain("git/refs/heads/main");
    expect(workerSource).toMatch(/"-F",\s*"force=false"/);
    expect(workerSource).not.toMatch(/"pr",\s*"merge"/);
  });

  it("runs all validation gates in a clean exact-SHA worktree before promotion", () => {
    expect(workerSource).toContain("runReleaseValidation(approvedSha)");
    expect(workerSource).toContain('run("npm", ["ci"]');
    expect(workerSource).toContain('run("npm", ["test"]');
    expect(workerSource).toContain('run("npm", ["run", "lint"]');
    expect(workerSource).toContain('run("npm", ["run", "typecheck"]');
    expect(workerSource).toContain('run("npm", ["run", "format:check"]');
    expect(workerSource).toContain('run("npm", ["run", "security:audit"]');
    expect(workerSource).toContain('run("npm", ["run", "build"]');
    expect(workerSource).not.toContain('"pr", "checks"');
  });

  it("rechecks live state after clean validation and before GitHub mutation", () => {
    const validationIndex = workerSource.indexOf("runReleaseValidation(approvedSha)");
    const recheckIndex = workerSource.indexOf("postValidationReport");
    const mutationIndex = workerSource.indexOf("matchingRefPath");

    expect(validationIndex).toBeGreaterThan(-1);
    expect(recheckIndex).toBeGreaterThan(validationIndex);
    expect(mutationIndex).toBeGreaterThan(recheckIndex);
    expect(workerSource).toContain(
      "assertPostValidationState(auditedProductionSha, postValidationReport, approvedSha)",
    );
  });

  it("reuses only an in-flight exact production run", () => {
    const query = releaseWorker.selectProductionRunQuery?.("d".repeat(40));

    expect(query).toContain("displayTitle");
    expect(query).toContain('status != "completed"');
    expect(query).not.toContain('conclusion == "success"');
    expect(workerSource).toContain("databaseId,displayTitle,status,conclusion");
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

  it("builds a release head from audited production with the exact test tree", () => {
    const guard = (
      releaseWorker as typeof releaseWorker & {
        assertReleaseHead?: (
          productionSha: string,
          testTree: string,
          releaseSha: string,
          parentShas: string[],
          releaseTree: string,
        ) => void;
      }
    ).assertReleaseHead;
    const testTree = "e".repeat(40);
    const releaseSha = "f".repeat(40);

    expect(guard).toBeTypeOf("function");
    expect(() =>
      guard?.(SHA_PROD, testTree, releaseSha, [SHA_PROD], testTree),
    ).not.toThrow();
    expect(() =>
      guard?.(SHA_PROD, testTree, releaseSha, [SHA_PROD], "0".repeat(40)),
    ).toThrow(/release head/i);
    expect(workerSource).toContain("git/commits");
    expect(workerSource).toContain("matching-refs/heads/release/exact-");
    expect(workerSource).toContain("assertReleaseHead(");
  });

  it("resumes an already-merged exact promotion instead of creating a duplicate PR", () => {
    expect(workerSource).toMatch(/"--state",\s*"all"/);
    expect(workerSource).toContain('existingPr.state === "MERGED"');
    expect(workerSource).toContain("existingPr.mergeCommit?.oid");
  });

  it("rejects retrying a merged promotion after main has advanced", () => {
    const guard = (
      releaseWorker as typeof releaseWorker & {
        assertCurrentMain?: (mergeSha: string, currentMainSha: string) => string;
      }
    ).assertCurrentMain;

    expect(guard).toBeTypeOf("function");
    expect(guard?.(SHA_TEST, SHA_TEST)).toBe(SHA_TEST);
    expect(() => guard?.(SHA_TEST, SHA_PROD)).toThrow(/main/i);
    expect(workerSource).toContain("assertCurrentMain(mergeCommitSha, currentMainSha)");
  });

  it("accepts a prior deployment only when live production serves the exact merge", () => {
    const guard = (
      releaseWorker as typeof releaseWorker & {
        assertProductionRelease?: (
          mergeSha: string,
          report: ReturnType<typeof evaluateAudit>,
        ) => string;
      }
    ).assertProductionRelease;
    const live = evaluateAudit(
      evidence({
        cloudGitSha: SHA_TEST,
        cloudMarkerSha: SHA_TEST,
        rtrda02GitSha: SHA_TEST,
        rtrda02MarkerSha: SHA_TEST,
      }),
    );

    expect(guard).toBeTypeOf("function");
    expect(guard?.(SHA_TEST, live)).toBe(SHA_TEST);
    expect(() => guard?.(SHA_PROD, live)).toThrow(/production/i);
    expect(workerSource).toContain(
      "assertProductionRelease(mergeCommitSha, finalReport)",
    );
  });

  it("allows recovery only for the exact merge already on main", () => {
    const guard = (
      releaseWorker as typeof releaseWorker & {
        assertRecoveryIdentity?: (
          testTree: string,
          mainSha: string,
          mainTree: string,
          mainParents: string[],
          releaseHeadSha: string,
          releaseTree: string,
          releaseParents: string[],
        ) => { productionSha: string; mergeSha: string };
      }
    ).assertRecoveryIdentity;
    const testTree = "d".repeat(40);
    const releaseHead = "e".repeat(40);
    const mergeSha = "f".repeat(40);

    expect(
      guard?.(
        testTree,
        mergeSha,
        testTree,
        [SHA_PROD, releaseHead],
        releaseHead,
        testTree,
        [SHA_PROD],
      ),
    ).toEqual({ productionSha: SHA_PROD, mergeSha });
    expect(() =>
      guard?.(
        testTree,
        mergeSha,
        "0".repeat(40),
        [SHA_PROD, releaseHead],
        releaseHead,
        testTree,
        [SHA_PROD],
      ),
    ).toThrow(/recovery identity/i);

    const targetGuard = (
      releaseWorker as typeof releaseWorker & {
        assertRecoveryTargets?: (
          report: ReturnType<typeof releaseWorker.evaluateAudit>,
          recovery: { productionSha: string; mergeSha: string },
        ) => void;
      }
    ).assertRecoveryTargets;
    const partialReport = releaseWorker.evaluateAudit({
      testContainerSha: SHA_TEST,
      originTestSha: SHA_TEST,
      testHealth: true,
      testPublicHealth: true,
      cloudGitSha: mergeSha,
      cloudMarkerSha: SHA_PROD,
      cloudHealth: true,
      rtrda02GitSha: mergeSha,
      rtrda02MarkerSha: mergeSha,
      rtrda02Health: true,
    });
    expect(() =>
      targetGuard?.(partialReport, { productionSha: SHA_PROD, mergeSha }),
    ).not.toThrow();
    expect(() =>
      targetGuard?.(
        releaseWorker.evaluateAudit({
          ...partialReport.evidence,
          cloudGitSha: "9".repeat(40),
          cloudMarkerSha: "9".repeat(40),
        }),
        { productionSha: SHA_PROD, mergeSha },
      ),
    ).toThrow(/production target/i);
    expect(workerSource).toContain("inspectRecoveryState(approvedSha)");
  });

  it("binds the dispatched merge commit to production, release head, and exact test tree", () => {
    const guard = (
      releaseWorker as typeof releaseWorker & {
        assertMergeIdentity?: (
          productionSha: string,
          releaseSha: string,
          testTree: string,
          mergeSha: string,
          parentShas: string[],
          mergeTree: string,
        ) => string;
      }
    ).assertMergeIdentity;
    const releaseSha = "e".repeat(40);
    const testTree = "f".repeat(40);
    const mergeSha = "d".repeat(40);

    expect(guard).toBeTypeOf("function");
    expect(
      guard?.(SHA_PROD, releaseSha, testTree, mergeSha, [SHA_PROD, releaseSha], testTree),
    ).toBe(mergeSha);
    expect(() =>
      guard?.(
        SHA_PROD,
        releaseSha,
        testTree,
        mergeSha,
        ["c".repeat(40), releaseSha],
        testTree,
      ),
    ).toThrow(/merge identity/i);
    expect(workerSource).toMatch(
      /assertMergeIdentity\(\s*auditedProductionSha,\s*releaseHeadSha,\s*testTree,\s*mergeCommitSha,\s*parentShas,\s*mergeTree,?\s*\)/,
    );
    expect(workerSource).not.toContain("commits/main");
  });

  it("promotes through a reviewed exact-tree PR and main CI without direct host deploys", () => {
    const plan = buildPromotionPlan(SHA_TEST);
    expect(plan.join("\n")).toContain("gh pr create");
    expect(plan.join("\n")).toContain("deploy-production.yml");
    expect(plan.join("\n")).not.toContain("gh pr merge");
    expect(plan.join("\n")).not.toContain("ssh ");
  });
});

describe("RTRDA partial promotion", () => {
  const SHA_ONE = "1".repeat(40);
  const SHA_TWO = "2".repeat(40);
  const SHA_TREE = "3".repeat(40);
  const SHA_CANDIDATE = "4".repeat(40);

  it("collects repeated commit flags in their supplied order", () => {
    expect(
      releaseWorker.valuesAfter?.(
        ["promote-partial", "--commit", SHA_ONE, "--commit", SHA_TWO],
        "--commit",
      ),
    ).toEqual([SHA_ONE, SHA_TWO]);
  });

  it("rejects missing, malformed, and duplicate selected commit SHAs", () => {
    expect(() => releaseWorker.validateSelectedCommitShas?.([])).toThrow(/at least one/i);
    expect(() => releaseWorker.validateSelectedCommitShas?.(["abc"])).toThrow(
      /full sha/i,
    );
    expect(() => releaseWorker.validateSelectedCommitShas?.([SHA_ONE, SHA_ONE])).toThrow(
      /duplicate/i,
    );
    expect(releaseWorker.validateSelectedCommitShas?.([SHA_ONE, SHA_TWO])).toEqual([
      SHA_ONE,
      SHA_TWO,
    ]);
  });

  it("requires every selected commit to be single-parent and reachable from deployed Test", () => {
    const guard = releaseWorker.assertSelectableCommit;
    expect(guard).toBeTypeOf("function");
    expect(() => guard?.(SHA_ONE, [SHA_PROD], true)).not.toThrow();
    expect(() => guard?.(SHA_ONE, [], true)).toThrow(/single-parent/i);
    expect(() => guard?.(SHA_ONE, [SHA_PROD, SHA_TWO], true)).toThrow(/single-parent/i);
    expect(() => guard?.(SHA_ONE, [SHA_PROD], false)).toThrow(/deployed test/i);
  });

  it("binds a partial candidate to production, deployed Test, ordered commits, tree, and SHA", () => {
    const identity = {
      productionSha: SHA_PROD,
      deployedTestSha: SHA_TEST,
      selectedCommitShas: [SHA_ONE, SHA_TWO],
      skippedCommitShas: [],
      candidateTree: SHA_TREE,
      candidateSha: SHA_CANDIDATE,
    };
    expect(releaseWorker.assertPartialCandidateIdentity?.(identity, identity)).toEqual(
      identity,
    );
    expect(() =>
      releaseWorker.assertPartialCandidateIdentity?.(identity, {
        ...identity,
        selectedCommitShas: [SHA_TWO, SHA_ONE],
      }),
    ).toThrow(/candidate identity/i);
    expect(() =>
      releaseWorker.assertPartialCandidateIdentity?.(identity, {
        ...identity,
        productionSha: "5".repeat(40),
      }),
    ).toThrow(/candidate identity/i);
  });

  it("accepts RC evidence only for the exact candidate revision, tree, and healthy runtime", () => {
    const valid = {
      candidateSha: SHA_CANDIDATE,
      candidateTree: SHA_TREE,
      containerSha: SHA_CANDIDATE,
      worktreeTree: SHA_TREE,
      healthy: true,
    };
    expect(releaseWorker.assertReleaseCandidateEvidence?.(valid)).toEqual(valid);
    expect(() =>
      releaseWorker.assertReleaseCandidateEvidence?.({ ...valid, containerSha: SHA_ONE }),
    ).toThrow(/release candidate/i);
    expect(() =>
      releaseWorker.assertReleaseCandidateEvidence?.({ ...valid, healthy: false }),
    ).toThrow(/release candidate/i);
  });

  it("builds a fail-closed partial promotion plan without changing exact promotion", () => {
    const plan = releaseWorker.buildPartialPromotionPlan?.({
      productionSha: SHA_PROD,
      deployedTestSha: SHA_TEST,
      selectedCommitShas: [SHA_ONE, SHA_TWO],
      candidateSha: SHA_CANDIDATE,
    });
    expect(plan?.join("\n")).toContain(`release/partial-${SHA_CANDIDATE}`);
    expect(plan?.join("\n")).toContain("release candidate");
    expect(plan?.join("\n")).toContain("RTRDA02 backup");
    expect(plan?.join("\n")).toContain("deploy-production.yml");
    expect(buildPromotionPlan(SHA_TEST).join("\n")).toContain(
      `release/exact-${SHA_TEST}`,
    );
  });

  it("exposes promote-partial with explicit candidate approval and fresh live checks", () => {
    expect(workerSource).toContain('operation === "promote-partial"');
    expect(workerSource).toContain('valuesAfter(args, "--commit")');
    expect(workerSource).toContain('valueAfter(args, "--approved-candidate-sha")');
    expect(workerSource).toContain("buildPartialCandidate(");
    expect(workerSource).toContain("runReleaseCandidate(");
    expect(workerSource).toContain('"audit:parity"');
    expect(workerSource).toContain("http://127.0.0.1:3022");
    expect(workerSource).toContain('join(sourceRepoPath, "public/wp-content/uploads/")');
    expect(workerSource).toContain('join(sourceRepoPath, "public/sdc-downloads/")');
    expect(workerSource).toContain("collectReleaseCandidateEvidence(candidate)");
    expect(workerSource).toContain("assertPartialCandidateIdentity(");
    expect(workerSource).toContain("executePartialPromotion(");
  });

  it("recovers a verified partial release and preserves the requested repository path", () => {
    expect(workerSource).toContain("inspectPartialRecoveryState(");
    expect(workerSource).toContain(
      "const inspectedPartialRecovery = inspectPartialRecoveryState(approvedCandidateSha)",
    );
    expect(workerSource).toContain("options.partialIdentity && recoveryMode");
    expect(workerSource).toContain("options.repoPath ?? process.cwd()");
    expect(workerSource).toContain("RC evidence retained at");
    expect(workerSource).toContain("if (completed)");
    expect(workerSource).toMatch(/"down",\s*"--volumes",\s*"--remove-orphans"/);
  });

  it("keeps the Docker builder capable of running Git-backed integration tests", () => {
    const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/apt-get install[^\n]*git/);
  });

  it("keeps Test isolated and binds RC only to localhost port 3022", () => {
    const compose = readFileSync(
      join(process.cwd(), "docker-compose.release-candidate.yml"),
      "utf8",
    );
    expect(compose).toContain("web-app-rtrda-release-candidate");
    expect(compose).toContain("127.0.0.1:3022:3000");
    expect(compose).toContain("rtrda-release-candidate-db-data");
    expect(compose).not.toContain("web-app-rtrda-test");
    expect(compose).not.toContain("rtrda-db-data");
  });

  it("reconstructs an ordered candidate from production and skips an already-present patch", () => {
    const repo = mkdtempSync(join(tmpdir(), "rtrda-partial-test-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: repo,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Test",
          GIT_AUTHOR_EMAIL: "test@example.invalid",
          GIT_COMMITTER_NAME: "Test",
          GIT_COMMITTER_EMAIL: "test@example.invalid",
        },
      }).trim();
    try {
      git("init", "-q");
      writeFileSync(join(repo, "content.txt"), "base\n");
      git("add", "content.txt");
      git("commit", "-q", "-m", "base");
      const productionSha = git("rev-parse", "HEAD");

      writeFileSync(join(repo, "content.txt"), "base\nfirst\n");
      git("commit", "-qam", "first");
      const firstSha = git("rev-parse", "HEAD");
      writeFileSync(join(repo, "content.txt"), "base\nfirst\nsecond\n");
      git("commit", "-qam", "second");
      const secondSha = git("rev-parse", "HEAD");
      const deployedTestSha = secondSha;

      const result = releaseWorker.buildPartialCandidate?.({
        repoPath: repo,
        productionSha,
        deployedTestSha,
        selectedCommitShas: [firstSha, secondSha],
      });
      expect(result?.selectedCommitShas).toEqual([firstSha, secondSha]);
      expect(result?.skippedCommitShas).toEqual([]);
      expect(result?.changedFiles).toEqual(["M\tcontent.txt"]);
      expect(result?.candidateTree).toMatch(/^[0-9a-f]{40}$/);
      expect(result?.candidateSha).toMatch(/^[0-9a-f]{40}$/);

      git("checkout", "-q", "--detach", productionSha);
      writeFileSync(join(repo, "content.txt"), "base\nfirst\n");
      git("commit", "-qam", "production already has first patch");
      const advancedProductionSha = git("rev-parse", "HEAD");
      const withSkip = releaseWorker.buildPartialCandidate?.({
        repoPath: repo,
        productionSha: advancedProductionSha,
        deployedTestSha,
        selectedCommitShas: [firstSha, secondSha],
      });
      expect(withSkip?.skippedCommitShas).toEqual([firstSha]);
      expect(withSkip?.selectedCommitShas).toEqual([firstSha, secondSha]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
