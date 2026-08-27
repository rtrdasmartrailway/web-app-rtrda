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
  applyBoardExecutiveOverride,
  CHAIYUT_IMAGE_SRC,
  CHAIYUT_NAME,
  TACHAKORN_IMAGE_SRC,
} from "./board-executive-override";
import {
  buildBoardExecutivePresentation,
  isBoardExecutivePath,
} from "./board-executives";
import { getBoardExecutiveDetailByTrigger } from "./board-executive-details";

async function boardRecord(path = "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร") {
  const manifest = JSON.parse(
    await readFile("src/data/wp-content.json", "utf8"),
  ) as WpImportManifest;
  const record = manifest.records.find((item) => item.path === path);
  expect(record).toBeDefined();
  return applyBoardExecutiveOverride(record!);
}

describe("board executive parser", () => {
  it("selects Thai and English content for Chotichai's popup", () => {
    const thai = getBoardExecutiveDetailByTrigger("chotchai", "th");
    const english = getBoardExecutiveDetailByTrigger("chotchai", "en");

    expect(thai?.html).toContain("ประวัติการศึกษา");
    expect(thai?.html).toContain("รศ.ดร. โชติชัย เจริญงาม");
    expect(english?.html).toContain("Education");
    expect(english?.html).toContain("Assoc. Prof. Dr. Chotichai Charoenngam");
    expect(english?.html).not.toContain("ประวัติการศึกษา");
  });

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
      "ผู้จัดการกลุ่มบริหารภายใน (รักษาการแทน)",
    ]);
    expect(presentation?.chart.generalManagers[0]).toMatchObject({
      name: "ธัชกร ธนวัฒนาดำรง",
      role: "ผู้จัดการกลุ่มวิจัยและมาตรฐาน",
      email: "touchakorn.t@rtrda.or.th",
      imageSrc: TACHAKORN_IMAGE_SRC,
      vacant: false,
    });
  });

  it("cleans inline email labels out of positions", async () => {
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
    }
    expect(people.filter((person) => person.vacant)).toHaveLength(4);
  });

  it("fills the research and standards GM and keeps the requested digital GM vacant", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    const generalManagers = presentation?.chart.generalManagers ?? [];
    const gmByRole = new Map(generalManagers.map((person) => [person.role, person]));

    expect(gmByRole.get("ผู้จัดการกลุ่มวิจัยและมาตรฐาน")).toMatchObject({
      name: "ธัชกร ธนวัฒนาดำรง",
      imageSrc: TACHAKORN_IMAGE_SRC,
      email: "touchakorn.t@rtrda.or.th",
      vacant: false,
    });

    expect(gmByRole.get("ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง")).toMatchObject({
      name: "",
      imageSrc: null,
      email: null,
      vacant: true,
    });

    expect(gmByRole.get("ผู้จัดการกลุ่มบริหารภายใน (รักษาการแทน)")).toMatchObject({
      name: CHAIYUT_NAME,
      imageSrc: CHAIYUT_IMAGE_SRC,
      email: "chaiwooth.t@rtrda.or.th",
      vacant: false,
    });

    expect(generalManagers.map((person) => person.name)).not.toContain("ชัชวาล พานวงษ์");
  });

  it("renders the executive chart with detail buttons only for people that have imported details", async () => {
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

    expect(html).toContain("mailto:piangor@rtrda.or.th");
    expect(html).toContain("mailto:touchakorn.t@rtrda.or.th");
    expect(html).not.toContain("TEL");
    expect(html).not.toContain("082 204 2998 / 02 248 2988");
    expect(html).toContain(">(ว่าง)</span>");
    expect(html).not.toContain(">?</span>");
    const detailButtonMatches = html.match(/>รายละเอียด<\/button>/g) ?? [];
    expect(detailButtonMatches).toHaveLength(4);
    const disabledDetailButtonMatches =
      html.match(/disabled="" type="button">รายละเอียด<\/button>/g) ?? [];
    expect(disabledDetailButtonMatches).toHaveLength(3);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("renders vacant cards with the full card structure", async () => {
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

    const vacantCards = html.match(/<article[^>]*_vacant[^>]*>.*?<\/article>/g) ?? [];
    expect(vacantCards).toHaveLength(4);
    const managerRoles = new Set([
      "ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง",
      "ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร",
    ]);
    for (const card of vacantCards) {
      expect(card).toContain("(ว่าง)");
      const roleMatch = card.match(/_(role_[^"]+)">([^<]+)</);
      expect(roleMatch).not.toBeNull();
      const role = roleMatch?.[2] ?? "";
      expect(card).not.toContain("รอการแต่งตั้ง");
      expect(card).not.toMatch(/<img/);
      expect(card).not.toContain("mailto:");
      expect(card).not.toContain("manager-sub-units-trigger");
      if (managerRoles.has(role)) {
        expect(card).toContain("Email");
        expect(card).toMatch(/<dd[^>]*>-<\/dd>/);
      } else {
        expect(card).not.toContain("Email");
        expect(card).not.toContain("mailto:");
      }
    }
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
    expect(html).toContain("(ว่าง)");
    expect(html).toContain("ธัชกร ธนวัฒนาดำรง");
    expect(html).not.toContain("082 204 2998 / 02 248 2988");
    expect(html).not.toContain("ผู้อำนวยการ<br");
  });

  it("renders the sub-units เพิ่มเติม trigger on filled manager cards", async () => {
    const record = await boardRecord();
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    expect(presentation).not.toBeNull();

    const html = renderToStaticMarkup(
      createElement(BoardExecutiveContent, {
        presentation: presentation!,
      }),
    );

    const matches = html.match(/manager-sub-units-trigger/g) ?? [];
    expect(matches.length).toBe(3);
    expect(html).toContain("เพิ่มเติม");
  });
});
