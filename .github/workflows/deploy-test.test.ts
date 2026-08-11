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
    expect(dockerIgnore).toContain("!public/wp-content/uploads/2026/07/ทรงพระเจริญ.webp");
  });

  it("labels the running container with the exact pushed SHA", () => {
    expect(workflow).toContain('RTRDA_RELEASE_SHA="${GITHUB_SHA}"');
    expect(workflow).toContain("org.opencontainers.image.revision");
  });
});
