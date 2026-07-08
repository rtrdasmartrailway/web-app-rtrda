import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/deploy-production.yml"),
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
});
