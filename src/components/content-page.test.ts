import { describe, expect, it } from "vitest";
import { contentRouteClass } from "./content-page";

describe("contentRouteClass", () => {
  it("activates board executive responsive styles for Thai and English routes", () => {
    expect(contentRouteClass("/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร")).toBe(
      "content-board-executives",
    );
    expect(contentRouteClass("/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร")).toBe(
      "content-board-executives",
    );
  });

  it("keeps standards route styling intact", () => {
    expect(contentRouteClass("/มาตรฐานระบบราง-สทร")).toBe(
      "content-rail-standards",
    );
  });
});
