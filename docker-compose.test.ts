import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const compose = readFileSync(join(process.cwd(), "docker-compose.yml"), "utf8");

describe("test container release identity", () => {
  it("fails closed when a manual build omits RTRDA_RELEASE_SHA", () => {
    expect(compose).toContain(
      "org.opencontainers.image.revision: ${RTRDA_RELEASE_SHA:-unknown}",
    );
  });
});
