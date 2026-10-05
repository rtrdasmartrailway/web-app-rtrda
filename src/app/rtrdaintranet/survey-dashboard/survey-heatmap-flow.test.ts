import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "survey-dashboard.css"), "utf8");

describe("survey heat map vertical flow", () => {
  it("lets agency rows extend down the page without an inner height cap", () => {
    const block = css.match(/\.survey-heatmap-scroll\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(block).not.toMatch(/max-height\s*:/);
    expect(block).not.toMatch(/height\s*:/);
    expect(block).toMatch(/overflow-x\s*:\s*auto/);
  });
});
