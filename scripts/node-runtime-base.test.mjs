import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

test("both Docker Node stages use the October 2026 security release", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  const images = [
    ...dockerfile.matchAll(/^FROM\s+(node:[^\s]+)\s+AS\s+(deps|runner)$/gm),
  ].map((match) => match[1]);
  expect(images).toEqual(["node:22.23.4-bookworm-slim", "node:22.23.4-bookworm-slim"]);
});
