import { describe, expect, it } from "vitest";
import type { WpContentRecord, WpMediaAsset, WpNavigationItem } from "./types";
import {
  buildPrimaryNavigation,
  getSidebarItems,
  resolveFeaturedMediaPath,
  selectFallbackAsset,
} from "./presentation";

function record(overrides: Partial<WpContentRecord>): WpContentRecord {
  return {
    id: overrides.id ?? String(overrides.wpId ?? overrides.path),
    wpId: overrides.wpId ?? overrides.path ?? 0,
    language: overrides.language ?? "th",
    kind: overrides.kind ?? "page",
    path: overrides.path ?? "/",
    sourceUrl: overrides.sourceUrl ?? "https://www.rtrda.or.th/",
    title: overrides.title ?? "Untitled",
    excerpt: overrides.excerpt ?? "",
    contentHtml: overrides.contentHtml ?? "",
    modified: overrides.modified ?? "",
    date: overrides.date ?? "",
    parentPath: overrides.parentPath ?? null,
    categoryIds: overrides.categoryIds ?? [],
    featuredMediaId: overrides.featuredMediaId ?? null,
  };
}

describe("presentation helpers", () => {
  it("marks a parent navigation item active when the current path is one of its children", () => {
    const records = [
      record({ path: "/เกี่ยวกับ-สทร", title: "เกี่ยวกับ สทร." }),
      record({
        path: "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ",
        title: "กฏหมาย ระเบียบ ข้อบังคับ",
        parentPath: "/เกี่ยวกับ-สทร",
      }),
    ];

    const nav = buildPrimaryNavigation(records, "th", "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ");

    const about = nav.find((item) => item.path === "/เกี่ยวกับ-สทร");
    expect(about?.active).toBe(true);
    expect(about?.children).toEqual([
      {
        label: "กฏหมาย ระเบียบ ข้อบังคับ",
        href: "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ",
        path: "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ",
        external: false,
        active: true,
        children: [],
      },
    ]);
  });

  it("preserves WordPress menu children that are not page-tree children", () => {
    const wordpressMenu: WpNavigationItem[] = [
      {
        label: "หน้าแรก",
        href: "/",
        path: "/",
        external: false,
        children: [],
      },
      {
        label: "เกี่ยวกับ สทร.",
        href: "#",
        path: null,
        external: false,
        children: [
          {
            label: "ความเป็นมา",
            href: "/เกี่ยวกับ-สทร/ความเป็นมา",
            path: "/เกี่ยวกับ-สทร/ความเป็นมา",
            external: false,
            children: [],
          },
          {
            label: "กฏหมาย ระเบียบ ข้อบังคับที่เกี่ยวข้อง",
            href: "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ",
            path: "/เกี่ยวกับ-สทร/กฏหมาย-ระเบียบ-ข้อบังคับ",
            external: false,
            children: [],
          },
          {
            label: "วัตถุประสงค์การจัดตั้งองค์การมหาชนและอำนาจหน้าที่",
            href: "/วัตถุประสงค์การจัดตั้ง",
            path: "/วัตถุประสงค์การจัดตั้ง",
            external: false,
            children: [],
          },
          {
            label: "วิสัยทัศน์และพันธกิจ",
            href: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ",
            path: "/เกี่ยวกับ-สทร/วิสัยทัศน์-พันธกิจ",
            external: false,
            children: [],
          },
          {
            label: "ค่านิยมองค์กร",
            href: "/เกี่ยวกับ-สทร/ค่านิยมองค์กร",
            path: "/เกี่ยวกับ-สทร/ค่านิยมองค์กร",
            external: false,
            children: [],
          },
          {
            label: "พัฒนาระบบราชการ",
            href: "/พัฒนาระบบราชการ",
            path: "/พัฒนาระบบราชการ",
            external: false,
            children: [],
          },
          {
            label: "คณะกรรมการและผู้บริหาร",
            href: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
            path: "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร",
            external: false,
            children: [],
          },
          {
            label: "โครงสร้างองค์กร",
            href: "/เกี่ยวกับ-สทร/โครงสร้างองค์กร",
            path: "/เกี่ยวกับ-สทร/โครงสร้างองค์กร",
            external: false,
            children: [],
          },
          {
            label: "ตราสัญลักษณ์ สทร.",
            href: "/เกี่ยวกับ-สทร/ตราสัญลักษณ์-สทร",
            path: "/เกี่ยวกับ-สทร/ตราสัญลักษณ์-สทร",
            external: false,
            children: [],
          },
        ],
      },
    ];

    const nav = buildPrimaryNavigation(
      [],
      "th",
      "/พัฒนาระบบราชการ",
      wordpressMenu,
    );

    const about = nav.find((item) => item.label === "เกี่ยวกับ สทร.");
    expect(about?.active).toBe(true);
    expect(about?.href).toBe("#");
    expect(about?.path).toBeNull();
    expect(about?.children).toHaveLength(9);
    expect(about?.children.map((item) => item.label)).toEqual([
      "ความเป็นมา",
      "กฏหมาย ระเบียบ ข้อบังคับที่เกี่ยวข้อง",
      "วัตถุประสงค์การจัดตั้งองค์การมหาชนและอำนาจหน้าที่",
      "วิสัยทัศน์และพันธกิจ",
      "ค่านิยมองค์กร",
      "พัฒนาระบบราชการ",
      "คณะกรรมการและผู้บริหาร",
      "โครงสร้างองค์กร",
      "ตราสัญลักษณ์ สทร.",
    ]);
  });

  it("keeps placeholder and external WordPress menu metadata", () => {
    const wordpressMenu: WpNavigationItem[] = [
      {
        label: "ข่าวสาร/กิจกรรม",
        href: "#",
        path: null,
        external: false,
        children: [
          {
            label: "พ.ร.บ. ข้อมูลข่าวสารของราชการ พ.ศ. 2540",
            href: "https://infocenter.oic.go.th/rtrda/index.php",
            path: null,
            external: true,
            children: [],
          },
          {
            label: "ร่วมงานกับ สทร.",
            href: "#",
            path: null,
            external: false,
            children: [
              {
                label: "สมัครงาน",
                href: "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน",
                path: "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน",
                external: false,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const nav = buildPrimaryNavigation(
      [],
      "th",
      "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน",
      wordpressMenu,
    );

    expect(nav[0]).toMatchObject({ href: "#", path: null, external: false, active: true });
    expect(nav[0].children[0]).toMatchObject({
      href: "https://infocenter.oic.go.th/rtrda/index.php",
      path: null,
      external: true,
    });
    expect(nav[0].children[1]).toMatchObject({ href: "#", path: null, active: true });
    expect(nav[0].children[1].children[0]).toMatchObject({
      href: "/ข่าวสาร-กิจกรรม/ร่วมงานกับ-สทร/สมัครงาน",
      active: true,
    });
  });

  it("returns an imported image media path for records with valid featured media", () => {
    const media: WpMediaAsset[] = [
      {
        id: 99,
        sourceUrl: "https://www.rtrda.or.th/wp-content/uploads/post.jpg",
        localPath: "/wp-content/uploads/post.jpg",
        title: "Post image",
        alt: "",
        width: 1200,
        height: 800,
        mimeType: "image/jpeg",
      },
      {
        id: 100,
        sourceUrl: "https://www.rtrda.or.th/wp-content/uploads/file.pdf",
        localPath: "/wp-content/uploads/file.pdf",
        title: "PDF",
        alt: "",
        width: null,
        height: null,
        mimeType: "application/pdf",
      },
    ];

    expect(resolveFeaturedMediaPath(record({ featuredMediaId: 99 }), media)).toBe(
      "/wp-content/uploads/post.jpg",
    );
    expect(resolveFeaturedMediaPath(record({ featuredMediaId: 100 }), media)).toBeUndefined();
  });

  it("uses children for parent sidebars and siblings for child page sidebars", () => {
    const records = [
      record({ path: "/ผลงานและโครงการเด่น", title: "ผลงานและโครงการเด่น" }),
      record({
        path: "/ผลงานและโครงการเด่น/ยุทธศาสตร์เทคโนโลยีระบบราง",
        title: "ยุทธศาสตร์เทคโนโลยีระบบราง",
        parentPath: "/ผลงานและโครงการเด่น",
      }),
      record({
        path: "/ผลงานและโครงการเด่น/วิจัยและพัฒนา",
        title: "วิจัยและพัฒนา",
        parentPath: "/ผลงานและโครงการเด่น",
      }),
    ];

    expect(getSidebarItems(records, records[0]).map((item) => item.path)).toEqual([
      "/ผลงานและโครงการเด่น/ยุทธศาสตร์เทคโนโลยีระบบราง",
      "/ผลงานและโครงการเด่น/วิจัยและพัฒนา",
    ]);
    expect(getSidebarItems(records, records[1]).map((item) => item.path)).toEqual([
      "/ผลงานและโครงการเด่น/ยุทธศาสตร์เทคโนโลยีระบบราง",
      "/ผลงานและโครงการเด่น/วิจัยและพัฒนา",
    ]);
  });

  it("selects deterministic Stitch fallback assets by route kind", () => {
    expect(selectFallbackAsset(record({ kind: "post", path: "/a" }))).toBe(
      "/stitch-assets/rail-lab.png",
    );
    expect(selectFallbackAsset(record({ kind: "category", path: "/category/news" }))).toBe(
      "/stitch-assets/rail-network.png",
    );
    expect(selectFallbackAsset(record({ kind: "flipbook", path: "/3d-flip-book/6267" }))).toBe(
      "/stitch-assets/rail-strategy-map.png",
    );
  });
});
