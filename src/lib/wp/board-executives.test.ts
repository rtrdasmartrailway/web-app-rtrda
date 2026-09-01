import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
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
  ANAN_IMAGE_SRC,
  CHAIYUT_IMAGE_SRC,
  CHAIYUT_NAME,
  TACHAKORN_IMAGE_SRC,
} from "./board-executive-override";
import {
  buildBoardExecutivePresentation,
  isBoardExecutivePath,
} from "./board-executives";
import {
  getBoardExecutiveDetailByName,
  getBoardExecutiveDetailByTrigger,
} from "./board-executive-details";

async function boardRecord(path = "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร") {
  const manifest = JSON.parse(
    await readFile("src/data/wp-content.json", "utf8"),
  ) as WpImportManifest;
  const record = manifest.records.find((item) => item.path === path);
  expect(record).toBeDefined();
  return applyBoardExecutiveOverride(record!);
}

describe("board executive parser", () => {
  it("uses the requested board member order and Anan portrait in Thai and English", async () => {
    const expectedThai = [
      "รศ.ดร. โชติชัย เจริญงาม",
      "ดรุณ แสงฉาย",
      "ชาญเชาวน์ ไชยานุกิจ",
      "ผศ. พิศิษฐ์ แสง-ชูโต",
      "ดร. วีรเดช ชีวาพัฒนานุวงศ์",
      "วัชรชาญ สิริสุวรรณทัศน์",
      "ดร. พิเชฐ คุณาธรรมรักษ์",
      "นายอนันต์ โพธิ์นิ่มแดง",
      "พัฒนพงษ์ พงศ์ศุภสมิทธิ์",
      "ผศ.ดร.วีรชัย อาจหาญ",
      "ดร. เพียงออ เลาหะวิไลย",
    ];
    const expectedEnglish = [
      "Assoc. Prof. Dr. Chotchai Charoenngam",
      "Darun Saengshine",
      "Chanchao Chaiyanukij",
      "Asst. Prof. Pisit  Saeng-Xuto",
      "Dr. Weeradet Cheevapattananuwong",
      "Watcharachan Sirisuwannatash",
      "Dr. Pichet Kunadhamraks",
      "Anan Pho Nimdaeng",
      "Pattanaphong Phongnsupatsamit",
      "Asst. Prof. Dr. Veerachai Archan",
      "Dr. Piang-or Loahavilai",
    ];

    const boardPages: Array<[string, string[]]> = [
      ["/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร", expectedThai],
      ["/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร", expectedEnglish],
    ];
    for (const [path, expected] of boardPages) {
      const record = await boardRecord(path);
      const $ = cheerio.load(record.contentHtml, null, false);
      const board = $(".lightweight-accordion")
        .filter((_, element) =>
          /คณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง|Board of Directors/.test(
            $(element).find(".lightweight-accordion-title").first().text(),
          ),
        )
        .first();

      expect(
        board
          .find(".wp-block-column h4")
          .map((_, element) => $(element).text())
          .get(),
      ).toEqual(expected);
    }

    const thai = await boardRecord();
    const $thai = cheerio.load(thai.contentHtml, null, false);
    expect(
      $thai("h4")
        .filter((_, element) => $thai(element).text() === "นายอนันต์ โพธิ์นิ่มแดง")
        .closest(".wp-block-column")
        .find("img")
        .attr("src"),
    ).toBe(ANAN_IMAGE_SRC);
  });

  it("selects Thai and English content for Chotichai's popup", () => {
    const thai = getBoardExecutiveDetailByTrigger("chotchai", "th");
    const english = getBoardExecutiveDetailByTrigger("chotchai", "en");

    expect(thai?.html).toContain("ประวัติการศึกษา");
    expect(thai?.html).toContain("รศ.ดร. โชติชัย เจริญงาม");
    expect(english?.html).toContain("Education");
    expect(english?.html).toContain("Assoc. Prof. Dr. Chotchai Charoenngam");
    expect(english?.html).not.toContain("ประวัติการศึกษา");
    expect(
      getBoardExecutiveDetailByName("Assoc. Prof. Dr. Chotchai Charoenngam", "en")?.html,
    ).toBe(english?.html);
  });

  it("selects Thai and English content for Darun's popup", () => {
    const thai = getBoardExecutiveDetailByName("ดรุณ แสงฉาย", "th");
    const english = getBoardExecutiveDetailByName("Darun Saengshine", "en");

    expect(thai?.html).toContain("วิศวกรรมสาธารณสุขเขตร้อน");
    expect(thai?.html).toContain("อธิบดีกรมท่าอากาศยาน");
    expect(english?.html).toContain("Tropical Public Health Engineering");
    expect(english?.html).toContain("Director General, Department of Airports");
    expect(english?.html).not.toContain("วิศวกรรมสาธารณสุขเขตร้อน");
  });

  it("selects Thai and English content for Chanchao's popup", () => {
    const thai = getBoardExecutiveDetailByName("ชาญเชาวน์ ไชยานุกิจ", "th");
    const english = getBoardExecutiveDetailByName("ชาญเชาวน์ ไชยานุกิจ", "en");

    expect(thai?.html).toContain("เนติบัณฑิตไทย");
    expect(thai?.html).toContain("กรมคุมประพฤติ");
    expect(english?.html).toContain("Thai Barrister-at-Law");
    expect(english?.html).toContain("Director General, Department of Probation");
    expect(english?.html).not.toContain("เนติบัณฑิตไทย");
  });

  it("selects Thai and English content for Pisit's popup", () => {
    const thai = getBoardExecutiveDetailByName("ผศ. พิศิษฐ์ แสง-ชูโต", "th");
    const english = getBoardExecutiveDetailByName("Asst. Prof. Pisit Saeng-Xuto", "en");

    expect(thai?.html).toContain("ประธานสาขาวิศวกรรมอุตสาหการ");
    expect(thai?.html).toContain(
      "กรรมการบริหารกองทุนสมเด็จพระบรมโอรสาธิราชสยามมกุฎราชกุมาร",
    );
    expect(english?.html).toContain("Directorships and Committees");
    expect(english?.html).toContain("Director, e-Testing Bureau");
    expect(english?.html).not.toContain("ประธานสาขาวิศวกรรมอุตสาหการ");
  });

  it("selects Thai and English content for Pichet's popup", () => {
    const thai = getBoardExecutiveDetailByName("ดร. พิเชฐ คุณาธรรมรักษ์", "th");
    const english = getBoardExecutiveDetailByName("Dr. Pichet Kunadhamraks", "en");

    expect(thai?.html).toContain("วิศวกรรมขนส่ง");
    expect(thai?.html).toContain("อธิบดีกรมการขนส่งทางราง");
    expect(english?.html).toContain("Transportation Engineering");
    expect(english?.html).toContain("Director General, Department of Rail Transport");
    expect(english?.html).not.toContain("วิศวกรรมขนส่ง");
  });

  it("selects Thai and English content for Pattanaphong's popup", () => {
    const thai = getBoardExecutiveDetailByName("พัฒนพงษ์ พงศ์ศุภสมิทธิ์", "th");
    const english = getBoardExecutiveDetailByName("Pattanaphong Phongsupatsamit", "en");

    expect(thai?.html).toContain("วิศวกรรมการก่อสร้างและการจัดการ");
    expect(thai?.html).toContain("รองผู้ว่าการการรถไฟขนส่งมวลชนแห่งประเทศไทย");
    expect(english?.html).toContain("Construction Engineering and Management");
    expect(english?.html).toContain("Deputy Governor (Administration)");
    expect(english?.html).not.toContain("วิศวกรรมการก่อสร้างและการจัดการ");
  });

  it("selects Thai and English content for Piang-or's popup", () => {
    const thai = getBoardExecutiveDetailByName("ดร. เพียงออ เลาหะวิไลย", "th");
    const english = getBoardExecutiveDetailByName("Dr. Piang-or Loahavilai", "en");

    expect(thai?.html).toContain("กรรมการและเลขานุการฯ");
    expect(thai?.html).toContain("ศูนย์ Sister Cities Research Center");
    expect(english?.html).toContain("Member &amp; Secretary");
    expect(english?.html).toContain(
      "President, Rail Technology Research and Development Agency",
    );
    expect(english?.html).not.toContain("กรรมการและเลขานุการฯ");
  });

  it("selects Thai and English content for Weeradet's popup", () => {
    const thai = getBoardExecutiveDetailByName("ดร. วีรเดช ชีวาพัฒนานุวงศ์", "th");
    const english = getBoardExecutiveDetailByName(
      "Dr. Weeradet Cheevapattananuwong",
      "en",
    );

    expect(thai?.html).toContain("มหาวิทยาลัยฮอกไกโด");
    expect(thai?.html).toContain("วิศวกรใหญ่ กรมทางหลวงชนบท");
    expect(english?.html).toContain("Hokkaido University");
    expect(english?.html).toContain("Chief Engineer, Department of Rural Roads");
    expect(english?.html).not.toContain("มหาวิทยาลัยฮอกไกโด");
  });

  it("selects the updated Thai content for Watcharachan's popup", () => {
    const detail = getBoardExecutiveDetailByName("วัชรชาญ สิริสุวรรณทัศน์", "th");

    expect(detail?.html).toContain("กรรมการผู้ทรงคุณวุฒิ");
    expect(detail?.html).toContain("2565 - 2566 รองผู้ว่าการรถไฟแห่งประเทศไทย");
    expect(detail?.html).toContain(
      "2569 - ปัจจุบัน กรรมการผู้ทรงคุณวุฒิ ในคณะกรรมการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
    );
    expect(detail?.html).toContain(
      "2556 – 2569 ที่ปรึกษาของสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
    );
  });

  it("localizes every active English board, steering committee and advisor popup", () => {
    const activeEnglishNames = [
      "Chanchao Chaiyanukij",
      "Pattanaphong Phongnsupatsamit",
      "Watcharachan Sirisuwannatash",
      "Dr. Pichit Akrathit, Ph.D.",
      "Chanin Chaonirattisai",
      "Dr. Chatkaew Hart-Rawung",
      "Dr. Poovadol Sirirangsi",
      "Dr. Kitipong Promwong",
      "Dr. Tiranee Achalakul",
      "Dr. Tayakorn Chandrangsu",
      "Natthaphat Unhakhongkha",
      "Sucheep Suksawang",
      "Prof. Dr. Sukit Limpijumnong",
      "Dr. Sathian Charoenrien",
      "Yaowalux Champeeratana",
      "Chunhachit Sungmai",
      "Assoc. Prof. Dr. Nualnoi Treerat",
    ];

    for (const name of activeEnglishNames) {
      const detail = getBoardExecutiveDetailByName(name, "en");
      expect(detail?.html).toContain(name);
      expect(detail?.html).not.toMatch(/[\u0E00-\u0E7F]/);
    }
  });

  it("does not provide a popup for Anan's card", () => {
    expect(getBoardExecutiveDetailByName("นายอนันต์ โพธิ์นิ่มแดง", "th")).toBeNull();
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

  it("mirrors Thai executive card data in English", async () => {
    const record = await boardRecord("/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร");
    const presentation = buildBoardExecutivePresentation(record.path, record.contentHtml);
    const generalManagers = presentation?.chart.generalManagers ?? [];
    const gmByRole = new Map(generalManagers.map((person) => [person.role, person]));

    expect(gmByRole.get("Research and Standards Group Manager")).toMatchObject({
      name: "Touchakorn Thanawatdamrong",
      imageSrc: TACHAKORN_IMAGE_SRC,
      email: "touchakorn.t@rtrda.or.th",
      vacant: false,
    });
    expect(
      gmByRole.get("New Entrepreneurs and Business Development Group Manager"),
    ).toMatchObject({
      name: "Chaiyut Tanchai",
      imageSrc: CHAIYUT_IMAGE_SRC,
      email: "chaiwooth.t@rtrda.or.th",
      vacant: false,
    });
    expect(gmByRole.get("Internal Administration Group Manager (Acting)")).toMatchObject({
      name: "Chaiyut Tanchai",
      imageSrc: CHAIYUT_IMAGE_SRC,
      email: "chaiwooth.t@rtrda.or.th",
      vacant: false,
    });
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
