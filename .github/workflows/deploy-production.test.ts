import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/deploy-production.yml"),
  "utf8",
);
const deployTargetScript = readFileSync(
  join(process.cwd(), ".github/scripts/deploy-preprod-target.sh"),
  "utf8",
);
const deployRemoteScript = readFileSync(
  join(process.cwd(), ".github/scripts/deploy-preprod-remote.sh"),
  "utf8",
);

describe("Deploy rtrda.or.th production workflow", () => {
  it("deploys production only from main to cloud primary and rtrda02 fallback", () => {
    expect(workflow).toContain("branches:\n      - main");
    expect(workflow).toContain("TARGET_NAME=cloud");
    expect(workflow).toContain("TARGET_NAME=rtrda02");
    expect(workflow).toContain("http://100.77.64.92:3021/healthz");
    expect(workflow).toContain("http://100.91.174.121:3021/healthz");
    expect(workflow).toContain("https://rtrda.or.th/healthz");
    expect(workflow).toContain("https://www.rtrda.or.th/healthz");
    expect(workflow).toContain(
      "DATABASE_URL: postgresql://rtrda:***@localhost:5432/build",
    );
    expect(workflow).not.toContain("rtrda-web-prod-preview");
    expect(workflow).not.toContain("/srv/apps/web-app-rtrda-production");
    expect(workflow).not.toContain("http://100.91.174.121:3030/healthz");
  });

  it("builds before replacement and rolls back an unhealthy release", () => {
    expect(deployRemoteScript).toContain("PREVIOUS_COMPOSE");
    expect(deployRemoteScript).toContain('build "$APP_SERVICE"');
    expect(deployRemoteScript).toContain('up -d --no-build "$APP_SERVICE"');
    expect(deployRemoteScript).toContain("if ! docker compose");
    expect(deployRemoteScript).toContain("rollback_previous_release");
    expect(deployRemoteScript).toContain("restored previous healthy release");
  });

  it("preserves legacy host-mounted public assets during production deploy", () => {
    expect(deployTargetScript).toContain("public/wp-content/uploads/");
    expect(deployTargetScript).toContain("public/sdc-downloads/");
    expect(deployTargetScript).not.toContain("rsync -az --delete");
  });
});
