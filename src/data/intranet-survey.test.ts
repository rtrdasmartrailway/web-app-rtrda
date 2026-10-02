import { expect, it } from "vitest";
import { NAV } from "./intranet";

it("links the public survey dashboard from intranet navigation", () => {
  expect(NAV.flatMap((group) => group.children)).toContainEqual({
    label: "ภาพรวมผลสำรวจ",
    href: "/rtrdaintranet/survey-dashboard",
  });
});
