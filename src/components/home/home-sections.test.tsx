import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/home/home-sections.tsx"),
  "utf8",
);

describe("home survey QR section", () => {
  it("is not rendered on the home page", () => {
    expect(source).not.toContain("home-survey-qr");
    expect(source).not.toContain("mot-5440");
  });
});

describe("service banner links", () => {
  it("keeps the five internal service links on the current site", () => {
    const links = [...source.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
    expect(links.filter((href) => href.startsWith("/"))).toHaveLength(5);
    expect(links).not.toContainEqual(expect.stringContaining("test.rtrda.or.th"));
    expect(links).toContain("https://nrail.rtrda.or.th/");
  });
});
