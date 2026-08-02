#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FULL_SHA = /^[0-9a-f]{40}$/;

export function evaluateAudit(raw) {
  const evidence = { ...raw };
  const blockers = [];
  const valid = (value) => FULL_SHA.test(value ?? "");

  if (!valid(evidence.testContainerSha)) blockers.push("test_container_sha_unverified");
  if (evidence.testContainerSha !== evidence.originTestSha)
    blockers.push("test_deploy_not_on_origin_test");
  if (!evidence.testHealth) blockers.push("test_unhealthy");

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
      healthy: Boolean(evidence.testHealth),
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

export function buildPromotionPlan(sha) {
  return [
    `verify prospective main merge tree equals deployed test tree ${sha.slice(0, 7)}`,
    "if branch topology diverged, create an exact-tree release branch from main",
    `gh pr create --repo rtrdasmartrailway/web-app-rtrda --base main --head <SAFE_HEAD> --title "Promote deployed test ${sha.slice(0, 7)} to production" --body "Exact deployed test SHA: ${sha}"`,
    "gh pr merge <PR_NUMBER> --repo rtrdasmartrailway/web-app-rtrda --merge",
    "gh workflow run deploy-production.yml --repo rtrdasmartrailway/web-app-rtrda --ref main -f ref=<MERGED_MAIN_SHA> (fallback only if merge did not trigger CI)",
    "gh run watch <PRODUCTION_RUN_ID> --repo rtrdasmartrailway/web-app-rtrda --exit-status",
    "Re-run check and require Cloud/RTRDA02 release markers to equal the merged main SHA.",
  ];
}

export function choosePromotionStrategy({ approvedSha, testTree, prospectiveTree }) {
  if (testTree === prospectiveTree) {
    return { mode: "direct-test", headBranch: "test" };
  }
  return {
    mode: "exact-tree-release",
    headBranch: `release/exact-test-${approvedSha.slice(0, 12)}`,
  };
}

function preparePromotionHead(approvedSha, repoPath) {
  if (run("git", ["status", "--porcelain"], { cwd: repoPath })) {
    throw new Error("Promotion workspace must be clean");
  }
  run("git", ["fetch", "origin", "main", "test", "--prune"], { cwd: repoPath });
  const originTestSha = run("git", ["rev-parse", "origin/test"], { cwd: repoPath });
  if (originTestSha !== approvedSha) {
    throw new Error("Approved deployed SHA no longer equals origin/test");
  }
  const testTree = run("git", ["rev-parse", `${approvedSha}^{tree}`], {
    cwd: repoPath,
  });
  const prospectiveTree = run(
    "git",
    ["merge-tree", "--write-tree", "origin/main", approvedSha],
    { cwd: repoPath },
  ).split("\n")[0];
  const strategy = choosePromotionStrategy({
    approvedSha,
    testTree,
    prospectiveTree,
  });

  if (strategy.mode === "exact-tree-release") {
    run("git", ["switch", "-C", strategy.headBranch, "origin/main"], {
      cwd: repoPath,
    });
    run("git", ["read-tree", "--reset", "-u", approvedSha], { cwd: repoPath });
    run("git", ["add", "-A"], { cwd: repoPath });
    run(
      "git",
      [
        "commit",
        "--allow-empty",
        "-m",
        `chore(release): promote exact tested tree ${approvedSha.slice(0, 12)}`,
      ],
      { cwd: repoPath },
    );
    const releaseTree = run("git", ["rev-parse", "HEAD^{tree}"], {
      cwd: repoPath,
    });
    if (releaseTree !== testTree)
      throw new Error("Exact-tree release verification failed");
    run("git", ["push", "--force-with-lease", "-u", "origin", strategy.headBranch], {
      cwd: repoPath,
    });
  }

  run("git", ["fetch", "origin", "main", strategy.headBranch], { cwd: repoPath });
  const safeProspectiveTree = run(
    "git",
    ["merge-tree", "--write-tree", "origin/main", `origin/${strategy.headBranch}`],
    { cwd: repoPath },
  ).split("\n")[0];
  if (safeProspectiveTree !== testTree) {
    throw new Error("Production PR would not preserve the exact tested tree");
  }
  return { ...strategy, testTree };
}

function executePromotion(approvedSha, repoPath) {
  const repo = "rtrdasmartrailway/web-app-rtrda";
  const strategy = preparePromotionHead(approvedSha, repoPath);
  let prNumber = run("gh", [
    "pr",
    "list",
    "--repo",
    repo,
    "--base",
    "main",
    "--head",
    strategy.headBranch,
    "--state",
    "open",
    "--json",
    "number",
    "--jq",
    ".[0].number // empty",
  ]);
  if (!prNumber) {
    const url = run("gh", [
      "pr",
      "create",
      "--repo",
      repo,
      "--base",
      "main",
      "--head",
      strategy.headBranch,
      "--title",
      `Promote deployed test ${approvedSha.slice(0, 7)} to production`,
      "--body",
      `Exact deployed test SHA: ${approvedSha}`,
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
  const checkCount = Number(
    run("gh", [
      "pr",
      "checks",
      prNumber,
      "--repo",
      repo,
      "--json",
      "name",
      "--jq",
      "length",
    ]) || "0",
  );
  if (checkCount > 0) {
    run("gh", ["pr", "checks", prNumber, "--repo", repo, "--watch"]);
  }
  run("gh", ["pr", "merge", prNumber, "--repo", repo, "--merge"]);
  const mainSha = run("gh", ["api", `repos/${repo}/commits/main`, "--jq", ".sha"]);

  let runId = "";
  for (let attempt = 0; attempt < 12 && !runId; attempt += 1) {
    runId = run("gh", [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      "deploy-production.yml",
      "--branch",
      "main",
      "--limit",
      "20",
      "--json",
      "databaseId,headSha",
      "--jq",
      `.[] | select(.headSha == "${mainSha}") | .databaseId`,
    ]).split("\n")[0];
    if (!runId) run("sleep", ["5"]);
  }
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
      `ref=${mainSha}`,
    ]);
    run("sleep", ["5"]);
    runId = run("gh", [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      "deploy-production.yml",
      "--limit",
      "1",
      "--json",
      "databaseId",
      "--jq",
      ".[0].databaseId",
    ]);
  }
  if (!runId) throw new Error("Production workflow run was not created");
  execFileSync("gh", ["run", "watch", runId, "--repo", repo, "--exit-status"], {
    stdio: "inherit",
  });
  return { prNumber, mainSha, productionRunId: runId, strategy };
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
  console.log(
    JSON.stringify(
      executePromotion(approvedSha, valueAfter(args, "--repo") ?? process.cwd()),
      null,
      2,
    ),
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
