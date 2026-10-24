import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("Prisma schema validates without duplicate model names", () => {
  const result = spawnSync("node_modules/.bin/prisma", ["validate"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://prisma:prisma@127.0.0.1:5432/rtrda_schema_test",
    },
    encoding: "utf8",
  });

  expect(result.error).toBeUndefined();
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
});
