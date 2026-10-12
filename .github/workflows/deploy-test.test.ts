import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/deploy-test.yml"),
  "utf8",
);
const dockerIgnore = readFileSync(join(process.cwd(), ".dockerignore"), "utf8");

describe("Deploy test.rtrda.or.th workflow", () => {
  it("deploys only the DGT test runtime and does not touch production targets", () => {
    expect(workflow).toContain("https://test.rtrda.or.th/healthz");
    expect(workflow).not.toContain(
      "Deploy exact test SHA to cloud primary and rtrda02 production fallback",
    );
    expect(workflow).not.toContain("TARGET_NAME=cloud");
    expect(workflow).not.toContain("TARGET_NAME=rtrda02");
    expect(workflow).not.toContain("https://rtrda.or.th/healthz");
    expect(workflow).not.toContain("https://www.rtrda.or.th/healthz");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(workflow).not.toContain("purge_cache");
  });

  it("includes the tracked popup asset in the Docker build context", () => {
    expect(dockerIgnore).toContain("!public/wp-content/uploads/2026/07/");
    expect(dockerIgnore).toContain(
      "!public/wp-content/uploads/2026/07/วันแม่แห่งชาติ-12-สิงหาคม-2569-v2.webp",
    );
  });

  it("runs the destructive WordPress seed only when the manifest changed", () => {
    expect(workflow).toContain("DEPLOY_BASE_SHA: ${{ github.event.before }}");
    expect(workflow).toContain(
      'git diff --quiet "$DEPLOY_BASE_SHA" "$GITHUB_SHA" -- src/data/wp-content.json',
    );
    expect(workflow).toContain("skipping the full-reload WordPress seed");
    expect(workflow).toContain("npm run db:seed");
  });

  it("labels the running container with the exact pushed SHA", () => {
    expect(workflow).toContain('RTRDA_RELEASE_SHA="${GITHUB_SHA}"');
    expect(workflow).toContain("org.opencontainers.image.revision");
  });

  it("starts and health-checks the PR Center outbox worker", () => {
    expect(workflow).toContain(
      "web-app-rtrda-test pr-center-api pr-center-outbox-worker",
    );
    expect(workflow).toContain("http://127.0.0.1:3101/healthz");
  });
});
