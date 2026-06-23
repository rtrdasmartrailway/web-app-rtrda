import { describe, expect, it } from "vitest";
import type { PresentationNavItem } from "./presentation";
import {
  applyContactNavOverride,
  NACC_COMPLAINT_URL,
  PACC_COMPLAINT_URL,
} from "./contact-nav-override";

function contactItem(
  children: PresentationNavItem[] = [],
): PresentationNavItem {
  return {
    label: "ติดต่อเรา",
    href: "/ติดต่อเรา",
    path: "/ติดต่อเรา",
    external: false,
    active: false,
    children,
  };
}

function simpleItem(label: string): PresentationNavItem {
  return {
    label,
    href: `/${label}`,
    path: `/${label}`,
    external: false,
    active: false,
    children: [],
  };
}

describe("applyContactNavOverride", () => {
  it("returns the same reference for English", () => {
    const navItems: PresentationNavItem[] = [contactItem()];
    expect(applyContactNavOverride(navItems, "en")).toBe(navItems);
  });

  it("returns the same reference when the contact item is missing", () => {
    const navItems: PresentationNavItem[] = [simpleItem("หน้าแรก")];
    expect(applyContactNavOverride(navItems, "th")).toBe(navItems);
  });

  it("appends the NACC and PACC children to the Thai contact dropdown", () => {
    const original = contactItem([
      {
        label: "ช่องทางการติดต่อ",
        href: "/ติดต่อเรา/ช่องทางการติดต่อ",
        path: "/ติดต่อเรา/ช่องทางการติดต่อ",
        external: false,
        active: false,
        children: [],
      },
    ]);
    const navItems: PresentationNavItem[] = [
      simpleItem("หน้าแรก"),
      original,
      simpleItem("ผลงานและโครงการเด่น"),
    ];

    const next = applyContactNavOverride(navItems, "th");

    expect(next).not.toBe(navItems);
    expect(next[0]).toBe(navItems[0]);
    expect(next[2]).toBe(navItems[2]);

    const updated = next[1];
    expect(updated.label).toBe("ติดต่อเรา");
    expect(updated.children).toHaveLength(3);

    const [existing, nacc, pacc] = updated.children;
    expect(existing.label).toBe("ช่องทางการติดต่อ");
    expect(nacc).toMatchObject({
      label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ช.",
      href: NACC_COMPLAINT_URL,
      path: null,
      external: true,
      active: false,
    });
    expect(pacc).toMatchObject({
      label: "ช่องทางแจ้งเรื่องร้องเรียนฯ สำนักงาน ป.ป.ท",
      href: PACC_COMPLAINT_URL,
      path: null,
      external: true,
      active: false,
    });
  });

  it("is idempotent and does not duplicate the entries", () => {
    const once = applyContactNavOverride([contactItem()], "th");
    const twice = applyContactNavOverride(once, "th");
    expect(twice).toBe(once);
    expect(once[0].children).toHaveLength(2);
  });

  it("appends the new entries after existing children without reordering", () => {
    const a = simpleItem("ช่องทางการติดต่อ");
    const b = simpleItem("ช่องทางการแจ้งเรื่องการทุจริตฯ");
    const next = applyContactNavOverride([contactItem([a, b])], "th");
    expect(next[0].children[0]).toBe(a);
    expect(next[0].children[1]).toBe(b);
    expect(next[0].children[2].label).toContain("ป.ป.ช.");
    expect(next[0].children[3].label).toContain("ป.ป.ท");
  });
});
