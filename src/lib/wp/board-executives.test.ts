import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BoardExecutiveContent,
  BoardExecutiveOrgChart,
} from "@/components/board-executive-org-chart";
import type { WpImportManifest } from "./types";
import {
  buildBoardExecutivePresentation,
  isBoardExecutivePath,
} from "./board-executives";

async function boardRecord(path = "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร") {
  const manifest = JSON.parse(
    await readFile("src/data/wp-content.json", "utf8"),
  ) as WpImportManifest;
  const record = manifest.records.find((item) => item.path === path);
  expect(record).toBeDefined();
  return record!;
}

describe("board executive parser", () => {
  it("detects the Thai and English board executive routes", () => {
    expect(isBoardExecutivePath("/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร")).toBe(true);
    expect(isBoardExecutivePath("/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร")).toBe(true);
    expect(isBoardExecutivePath("/เกี่ยวกับ-สทร")).toBe(false);
  });

  it("extracts the current Thai executive fixture into the requested hierarchy", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);

    expect(presentation).not.toBeNull();
    expect(presentation?.chart.title).toBe(
      "ผู้บริหารสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)",
    );
    expect(presentation?.open).toBe(false);
    expect(presentation?.chart.director).toMatchObject({
      name: "ดร. เพียงออ เลาหะวิไลย",
      role: "ผู้อำนวยการ",
      email: "piangor@rtrda.or.th",
      vacant: false,
    });
    expect(presentation?.chart.deputies).toHaveLength(2);
    expect(presentation?.chart.generalManagers).toHaveLength(5);
    expect(presentation?.chart.generalManagers.map((person) => person.role)).toEqual([
      "ผู้จัดการกลุ่มวิจัยและมาตรฐาน",
      "ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่",
      "ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง",
      "ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร",
      "ผู้จัดการกลุ่มบริหารภายใน",
    ]);
  });

  it("cleans inline email labels out of positions and keeps office phone on every card", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    const people = presentation
      ? [
          presentation.chart.director,
          ...presentation.chart.deputies,
          ...presentation.chart.generalManagers,
        ]
      : [];

    expect(people).toHaveLength(8);
    for (const person of people) {
      expect(person.role).not.toMatch(/อีเมล|e-mail|@/i);
      expect(person.officePhone).toBe("082 204 2998 / 02 248 2988");
    }
    expect(people.filter((person) => person.vacant)).toHaveLength(6);
  });

  it("marks the requested GM roles as waiting for appointment", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    const generalManagers = presentation?.chart.generalManagers ?? [];
    const gmByRole = new Map(generalManagers.map((person) => [person.role, person]));

    for (const role of [
      "ผู้จัดการกลุ่มวิจัยและมาตรฐาน",
      "ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง",
    ]) {
      expect(gmByRole.get(role)).toMatchObject({
        name: "",
        imageSrc: null,
        email: null,
        vacant: true,
      });
    }

    expect(generalManagers.map((person) => person.name)).not.toContain(
      "ดร.กิติพันธุ์ นุตยกุล",
    );
    expect(generalManagers.map((person) => person.name)).not.toContain("ชัชวาล พานวงษ์");
  });

  it("renders the executive chart without detail buttons", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    expect(presentation).not.toBeNull();

    const html = renderToStaticMarkup(
      createElement(BoardExecutiveOrgChart, {
        chart: presentation!.chart,
        language: record.language,
        open: presentation!.open,
      }),
    );

    expect(html).toContain("082 204 2998 / 02 248 2988");
    expect(html).toContain("mailto:piangor@rtrda.or.th");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">รอการแต่งตั้ง</span>");
    expect(html).not.toContain(">?</span>");
    expect(html).not.toContain("รายละเอียด");
  });

  it("replaces the executive WordPress block when rendering the full board content", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    expect(presentation?.segments.map((segment) => segment.kind)).toContain(
      "executiveChart",
    );

    const html = renderToStaticMarkup(
      createElement(BoardExecutiveContent, {
        presentation: presentation!,
      }),
    );

    expect(html).toContain("lightweight-accordion");
    expect(html).toContain("lightweight-accordion-title");
    expect(html).toContain("lightweight-accordion-body");
    expect(html).toContain("<details>");
    expect(html).not.toContain('<details open="">');
    expect(html).toContain("รอการแต่งตั้ง");
    expect(html).toContain("082 204 2998 / 02 248 2988");
    expect(html).not.toContain("ผู้อำนวยการ<br");
  });
});
