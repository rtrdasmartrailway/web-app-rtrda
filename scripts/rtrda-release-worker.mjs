#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FULL_SHA = /^[0-9a-f]{40}$/;

export function evaluateAudit(raw) {
  const suppliedEvidence = raw?.evidence ?? raw ?? {};
  const evidence = { ...suppliedEvidence };
  const blockers = [];
  const valid = (value) => FULL_SHA.test(value ?? "");

  if (!valid(evidence.testContainerSha)) blockers.push("test_container_sha_unverified");
  if (evidence.testContainerSha !== evidence.originTestSha)
    blockers.push("test_deploy_not_on_origin_test");
  if (!evidence.testHealth) blockers.push("test_unhealthy");
  if (!evidence.testPublicHealth) blockers.push("test_public_unhealthy");

  const cloudConsistent =
    valid(evidence.cloudGitSha) && evidence.cloudGitSha === evidence.cloudMarkerSha;
  const rtrda02Consistent =
    valid(evidence.rtrda02GitSha) && evidence.rtrda02GitSha === evidence.rtrda02MarkerSha;
  if (!cloudConsistent) blockers.push("cloud_release_unverified");
  if (!rtrda02Consistent) blockers.push("rtrda02_release_unverified");
  if (
    evidence.cloudGitSha !== evidence.rtrda02GitSha ||
    evidence.cloudMarkerSha !== evidence.rtrda02MarkerSha
  )
    blockers.push("production_targets_not_in_parity");
  if (!evidence.cloudHealth) blockers.push("cloud_unhealthy");
  if (!evidence.rtrda02Health) blockers.push("rtrda02_unhealthy");

  return {
    operation: "check_web_test_update",
    readOnly: true,
    promotable: blockers.length === 0,
    test: {
      sha: valid(evidence.testContainerSha) ? evidence.testContainerSha : null,
      originTestSha: evidence.originTestSha ?? null,
      healthy: Boolean(evidence.testHealth && evidence.testPublicHealth),
      localHealthy: Boolean(evidence.testHealth),
      publicHealthy: Boolean(evidence.testPublicHealth),
    },
    production: {
      sha:
        cloudConsistent &&
        rtrda02Consistent &&
        evidence.cloudGitSha === evidence.rtrda02GitSha
          ? evidence.cloudGitSha
          : null,
      cloudHealthy: Boolean(evidence.cloudHealth),
      rtrda02Healthy: Boolean(evidence.rtrda02Health),
      parity:
        cloudConsistent &&
        rtrda02Consistent &&
        evidence.cloudGitSha === evidence.rtrda02GitSha,
    },
    changedFiles: evidence.changedFiles ?? [],
    blockers: [...new Set(blockers)],
    evidence,
  };
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function succeeds(command, args) {
  try {
    run(command, args);
    return true;
  } catch {
    return false;
  }
}

function collectLiveEvidence(repoPath = process.cwd()) {
  run("git", ["fetch", "origin", "test", "main", "--prune"], { cwd: repoPath });
  const testContainerSha = run("docker", [
    "inspect",
    "web-app-rtrda-test",
    "--format",
    '{{ index .Config.Labels "org.opencontainers.image.revision" }}',
  ]);
  const originTestSha = run("git", ["rev-parse", "origin/test"], { cwd: repoPath });
  const remote = (key, destination, path) => {
    const output = run("ssh", [
      "-i",
      key,
      "-o",
      "BatchMode=yes",
      destination,
      `cd ${path} && git rev-parse HEAD && cat .deploy-state/preprod-release`,
    ]).split(/\s+/);
    return { git: output[0] ?? "", marker: output[1] ?? "" };
  };
  const cloud = remote(
    `${process.env.HOME}/.ssh/rtrda-cloud-preprod-sync_ed25519`,
    "ubuntu@100.77.64.92",
    "/home/ubuntu/rtrda-preprod/web-app-rtrda",
  );
  const rtrda02 = remote(
    `${process.env.HOME}/.ssh/rtrda02_prod_preview_sync_ed25519`,
    "rtrda@100.91.174.121",
    "/srv/apps/web-app-rtrda-preprod-rtrda02",
  );
  const changedFiles = FULL_SHA.test(testContainerSha)
    ? run("git", ["diff", "--name-status", `${cloud.git}..${testContainerSha}`], {
        cwd: repoPath,
      })
        .split("\n")
        .filter(Boolean)
    : [];
  return {
    testContainerSha,
    originTestSha,
    cloudGitSha: cloud.git,
    cloudMarkerSha: cloud.marker,
    rtrda02GitSha: rtrda02.git,
    rtrda02MarkerSha: rtrda02.marker,
    testHealth: succeeds("curl", ["-fsS", "http://127.0.0.1:3020/healthz"]),
    testPublicHealth: succeeds("curl", ["-fsS", "https://test.rtrda.or.th/healthz"]),
    cloudHealth: succeeds("curl", ["-fsS", "http://100.77.64.92:3021/healthz"]),
    rtrda02Health: succeeds("curl", ["-fsS", "http://100.91.174.121:3021/healthz"]),
    changedFiles,
  };
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/rtrda-release-worker.mjs check [--repo PATH] [--evidence FILE]",
    "  node scripts/rtrda-release-worker.mjs promote --approved-sha SHA --evidence FILE [--execute]",
    "",
    "check is always read-only. promote fails closed unless the audited deployed test SHA",
    "matches origin/test and Cloud/RTRDA02 production are healthy and in parity.",
  ].join("\n");
}

export function assertLivePromotionState(report, liveReport, approvedSha) {
  if (
    !liveReport.promotable ||
    liveReport.test.sha !== approvedSha ||
    liveReport.test.originTestSha !== approvedSha
  ) {
    throw new Error("Live promotion state no longer matches the approved test release");
  }
  if (liveReport.production.sha !== report.production.sha) {
    throw new Error("Production release changed after evidence was captured");
  }
}

export function assertReleaseHead(
  productionSha,
  testTree,
  releaseSha,
  parentShas,
  releaseTree,
) {
  if (
    !FULL_SHA.test(productionSha ?? "") ||
    !FULL_SHA.test(testTree ?? "") ||
    !FULL_SHA.test(releaseSha ?? "") ||
    !FULL_SHA.test(releaseTree ?? "") ||
    parentShas.length !== 1 ||
    parentShas[0] !== productionSha ||
    releaseTree !== testTree
  ) {
    throw new Error("Release head is not an exact test tree based on audited production");
  }
}

export function assertMergeIdentity(
  productionSha,
  releaseSha,
  testTree,
  mergeSha,
  parentShas,
  mergeTree,
) {
  if (
    !FULL_SHA.test(productionSha ?? "") ||
    !FULL_SHA.test(releaseSha ?? "") ||
    !FULL_SHA.test(testTree ?? "") ||
    !FULL_SHA.test(mergeSha ?? "") ||
    !FULL_SHA.test(mergeTree ?? "") ||
    parentShas.length !== 2 ||
    parentShas[0] !== productionSha ||
    parentShas[1] !== releaseSha ||
    mergeTree !== testTree
  ) {
    throw new Error(
      "Merge identity does not match audited production, verified release head, and exact test tree",
    );
  }
  return mergeSha;
}

export function assertCurrentMain(mergeSha, currentMainSha) {
  if (
    !FULL_SHA.test(mergeSha ?? "") ||
    !FULL_SHA.test(currentMainSha ?? "") ||
    mergeSha !== currentMainSha
  ) {
    throw new Error("Verified merge commit is no longer the current main SHA");
  }
  return mergeSha;
}

export function selectProductionRunQuery(mainSha) {
  if (!FULL_SHA.test(mainSha ?? "")) throw new Error("main SHA must be a full SHA");
  return `.[] | select(.displayTitle == "Deploy production ${mainSha}") | select(.status != "completed" or .conclusion == "success") | .databaseId`;
}

export function buildPromotionPlan(sha) {
  const releaseBranch = `release/exact-${sha}`;
  return [
    `Create/reuse ${releaseBranch} with parent=<AUDITED_PRODUCTION_SHA> and tree=${sha}^{tree}`,
    `gh pr create --repo rtrdasmartrailway/web-app-rtrda --base main --head ${releaseBranch} --title "Promote exact deployed test ${sha.slice(0, 7)} to production" --body "Exact deployed test SHA: ${sha}"`,
    "Create and verify an exact-tree merge commit with parents [audited production, verified release head].",
    "Use GitHub's non-force atomic fast-forward to update refs/heads/main to the verified merge commit.",
    "gh workflow run deploy-production.yml --repo rtrdasmartrailway/web-app-rtrda --ref main -f ref=<VERIFIED_MERGE_COMMIT_SHA>",
    "gh run watch <PRODUCTION_RUN_ID> --repo rtrdasmartrailway/web-app-rtrda --exit-status",
    "Re-run check and require Cloud/RTRDA02 release markers to equal the merged main SHA.",
  ];
}

function executePromotion(approvedSha, auditedProductionSha) {
  const repo = "rtrdasmartrailway/web-app-rtrda";
  const testTree = run("git", ["rev-parse", `${approvedSha}^{tree}`]);
  const releaseBranch = `release/exact-${approvedSha}`;
  const matchingRefPath = `repos/${repo}/git/matching-refs/heads/release/exact-${approvedSha}`;
  let releaseHeadSha = run("gh", [
    "api",
    matchingRefPath,
    "--jq",
    `.[] | select(.ref == "refs/heads/${releaseBranch}") | .object.sha`,
  ]);
  if (!releaseHeadSha) {
    releaseHeadSha = run("gh", [
      "api",
      "--method",
      "POST",
      `repos/${repo}/git/commits`,
      "-f",
      `message=Promote exact deployed test ${approvedSha} to production`,
      "-f",
      `tree=${testTree}`,
      "-f",
      `parents[]=${auditedProductionSha}`,
      "--jq",
      ".sha",
    ]);
    run("gh", [
      "api",
      "--method",
      "POST",
      `repos/${repo}/git/refs`,
      "-f",
      `ref=refs/heads/${releaseBranch}`,
      "-f",
      `sha=${releaseHeadSha}`,
    ]);
  }
  const releaseCommit = JSON.parse(
    run("gh", ["api", `repos/${repo}/git/commits/${releaseHeadSha}`]),
  );
  const releaseParentShas = (releaseCommit.parents ?? []).map((parent) => parent.sha);
  assertReleaseHead(
    auditedProductionSha,
    testTree,
    releaseHeadSha,
    releaseParentShas,
    releaseCommit.tree?.sha,
  );
  const existingPrs = JSON.parse(
    run("gh", [
      "pr",
      "list",
      "--repo",
      repo,
      "--base",
      "main",
      "--head",
      releaseBranch,
      "--state",
      "all",
      "--json",
      "number,state,headRefOid,baseRefOid,mergeCommit",
    ]),
  );
  const existingPr =
    existingPrs.find(
      (candidate) =>
        candidate.headRefOid === releaseHeadSha && candidate.state === "MERGED",
    ) ??
    existingPrs.find(
      (candidate) =>
        candidate.headRefOid === releaseHeadSha && candidate.state === "OPEN",
    );
  let prNumber = existingPr?.number ? String(existingPr.number) : "";
  let mergeCommitSha =
    existingPr &&
    existingPr.state === "MERGED" &&
    FULL_SHA.test(existingPr.mergeCommit?.oid ?? "")
      ? existingPr.mergeCommit.oid
      : "";

  if (!mergeCommitSha) {
    if (existingPr && existingPr.state !== "OPEN") {
      throw new Error("Existing exact-tree promotion PR is not reusable");
    }
    if (!prNumber) {
      const url = run("gh", [
        "pr",
        "create",
        "--repo",
        repo,
        "--base",
        "main",
        "--head",
        releaseBranch,
        "--title",
        `Promote exact deployed test ${approvedSha.slice(0, 7)} to production`,
        "--body",
        `Exact deployed test SHA: ${approvedSha}\nExact deployed test tree: ${testTree}`,
      ]);
      prNumber = run("gh", [
        "pr",
        "view",
        url,
        "--repo",
        repo,
        "--json",
        "number",
        "--jq",
        ".number",
      ]);
    }
    run("gh", ["pr", "checks", prNumber, "--repo", repo, "--watch"]);
    const prIdentity = JSON.parse(
      run("gh", [
        "pr",
        "view",
        prNumber,
        "--repo",
        repo,
        "--json",
        "headRefOid,baseRefOid",
      ]),
    );
    if (prIdentity.headRefOid !== releaseHeadSha) {
      throw new Error("PR head no longer matches verified exact-tree release head");
    }
    if (prIdentity.baseRefOid !== auditedProductionSha) {
      throw new Error("PR base no longer matches audited production SHA");
    }
    const currentMainSha = run("gh", [
      "api",
      `repos/${repo}/git/refs/heads/main`,
      "--jq",
      ".object.sha",
    ]);
    if (currentMainSha !== auditedProductionSha) {
      throw new Error("Main changed after production evidence was captured");
    }

    mergeCommitSha = run("gh", [
      "api",
      "--method",
      "POST",
      `repos/${repo}/git/commits`,
      "-f",
      `message=Promote exact deployed test ${approvedSha} to production`,
      "-f",
      `tree=${testTree}`,
      "-f",
      `parents[]=${auditedProductionSha}`,
      "-f",
      `parents[]=${releaseHeadSha}`,
      "--jq",
      ".sha",
    ]);
    const pendingMerge = JSON.parse(
      run("gh", ["api", `repos/${repo}/git/commits/${mergeCommitSha}`]),
    );
    assertMergeIdentity(
      auditedProductionSha,
      releaseHeadSha,
      testTree,
      mergeCommitSha,
      (pendingMerge.parents ?? []).map((parent) => parent.sha),
      pendingMerge.tree?.sha,
    );
    run("gh", [
      "api",
      "--method",
      "PATCH",
      `repos/${repo}/git/refs/heads/main`,
      "-f",
      `sha=${mergeCommitSha}`,
      "-F",
      "force=false",
    ]);
    const updatedMainSha = run("gh", [
      "api",
      `repos/${repo}/git/refs/heads/main`,
      "--jq",
      ".object.sha",
    ]);
    if (updatedMainSha !== mergeCommitSha) {
      throw new Error("Atomic main update did not land on the verified merge commit");
    }
  }

  const mergeCommit = JSON.parse(
    run("gh", ["api", `repos/${repo}/git/commits/${mergeCommitSha}`]),
  );
  const parentShas = (mergeCommit.parents ?? []).map((parent) => parent.sha);
  const mergeTree = mergeCommit.tree?.sha;
  assertMergeIdentity(
    auditedProductionSha,
    releaseHeadSha,
    testTree,
    mergeCommitSha,
    parentShas,
    mergeTree,
  );

  const currentMainSha = run("gh", [
    "api",
    `repos/${repo}/git/refs/heads/main`,
    "--jq",
    ".object.sha",
  ]);
  assertCurrentMain(mergeCommitSha, currentMainSha);

  const findProductionRun = () =>
    run("gh", [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      "deploy-production.yml",
      "--event",
      "workflow_dispatch",
      "--limit",
      "20",
      "--json",
      "databaseId,displayTitle,status,conclusion",
      "--jq",
      selectProductionRunQuery(mergeCommitSha),
    ]).split("\n")[0];

  let runId = findProductionRun();
  if (!runId) {
    run("gh", [
      "workflow",
      "run",
      "deploy-production.yml",
      "--repo",
      repo,
      "--ref",
      "main",
      "-f",
      `ref=${mergeCommitSha}`,
    ]);
    for (let attempt = 0; attempt < 12 && !runId; attempt += 1) {
      runId = findProductionRun();
      if (!runId) run("sleep", ["5"]);
    }
  }
  if (!runId) throw new Error("Production workflow run was not created");
  execFileSync("gh", ["run", "watch", runId, "--repo", repo, "--exit-status"], {
    stdio: "inherit",
  });
  return { prNumber, mainSha: mergeCommitSha, productionRunId: runId };
}

function main() {
  const args = process.argv.slice(2);
  const operation = args[0];
  if (!operation || args.includes("--help")) {
    console.log(usage());
    return;
  }
  const evidenceFile = valueAfter(args, "--evidence");
  const evidence = evidenceFile
    ? JSON.parse(readFileSync(evidenceFile, "utf8"))
    : collectLiveEvidence(valueAfter(args, "--repo") ?? process.cwd());
  const report = evaluateAudit(evidence);

  if (operation === "check") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (operation !== "promote") throw new Error(`Unknown operation: ${operation}`);

  const approvedSha = valueAfter(args, "--approved-sha");
  if (!FULL_SHA.test(approvedSha ?? ""))
    throw new Error("--approved-sha must be a full SHA");
  if (!report.promotable)
    throw new Error(`Promotion blocked: ${report.blockers.join(", ")}`);
  if (report.test.sha !== approvedSha)
    throw new Error("Approved SHA does not match deployed test SHA");

  const commands = buildPromotionPlan(approvedSha);
  if (!args.includes("--execute")) {
    console.log(JSON.stringify({ dryRun: true, approvedSha, commands }, null, 2));
    return;
  }
  const liveReport = evaluateAudit(
    collectLiveEvidence(valueAfter(args, "--repo") ?? process.cwd()),
  );
  assertLivePromotionState(report, liveReport, approvedSha);
  console.log(
    JSON.stringify(executePromotion(approvedSha, report.production.sha), null, 2),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
