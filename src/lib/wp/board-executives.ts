import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpLanguage } from "./types";
import { getRtrdaPathFromUrl, normalizeRoutePath } from "./url";

const THAI_BOARD_PATH = "/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร";
const ENGLISH_BOARD_PATH = "/en/เกี่ยวกับ-สทร/คณะกรรมการ-ผู้บริหาร";
const FORCED_VACANT_NAMES = new Set(["ชัชวาล พานวงษ์"]);

export interface BoardExecutivePerson {
  name: string;
  role: string;
  imageSrc: string | null;
  imageAlt: string;
  email: string | null;
  vacant: boolean;
}

export interface BoardExecutiveOrgChart {
  title: string;
  director: BoardExecutivePerson;
  deputies: BoardExecutivePerson[];
  generalManagers: BoardExecutivePerson[];
}

export type BoardExecutiveContentSegment =
  | {
      kind: "html";
      html: string;
    }
  | {
      kind: "executiveChart";
    };

export interface BoardExecutivePresentation {
  language: WpLanguage;
  open: boolean;
  chart: BoardExecutiveOrgChart;
  segments: BoardExecutiveContentSegment[];
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isVacantName(value: string): boolean {
  const normalized = compactText(value).replace(/&#8211;/g, "–");
  return normalized === "" || /^[-–—]+$/.test(normalized);
}

function shouldForceVacant(value: string): boolean {
  return FORCED_VACANT_NAMES.has(compactText(value));
}

function normalizeImageSrc(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return getRtrdaPathFromUrl(value) ?? value;
}

function extractEmail($: CheerioAPI, element: AnyNode, text: string): string | null {
  const mailtoHref = $(element)
    .find('a[href^="mailto:"]')
    .map((_, link) => $(link).attr("href") ?? "")
    .get()
    .find((href) => href.includes("@"));

  if (mailtoHref) {
    const email = decodeURIComponent(mailtoHref.replace(/^mailto:/i, "").split("?")[0]);
    return email.includes("@") ? email : null;
  }

  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

function cleanRole(value: string, email: string | null): string {
  const withoutEmailLabel = value.split(/(?:อีเมล|e-?mail)\s*:/i)[0];
  const withoutEmail = withoutEmailLabel
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(email ?? "", "");
  return compactText(withoutEmail);
}

function parsePerson($: CheerioAPI, element: AnyNode): BoardExecutivePerson | null {
  const $card = $(element);
  const name = compactText($card.find("h4").first().text());
  const rawRole = compactText($card.find("h5").first().text());
  const text = compactText($card.text());
  const image = $card.find("img").first();

  if (!name && !rawRole && image.length === 0) {
    return null;
  }

  const email = extractEmail($, element, text);
  const role = cleanRole(rawRole, email);
  if (!role) {
    return null;
  }

  const vacant = isVacantName(name) || shouldForceVacant(name);

  return {
    name: vacant ? "" : name,
    role,
    imageSrc: vacant ? null : normalizeImageSrc(image.attr("src")),
    imageAlt: vacant ? "" : compactText(image.attr("alt") ?? name),
    email: vacant ? null : email,
    vacant,
  };
}

function isExecutiveTitle(title: string): boolean {
  return (
    title.includes("ผู้บริหารสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง") ||
    title.includes("Executive of Rail Technology Research and Development Agency")
  );
}

function languageFromPath(path: string): WpLanguage {
  return normalizeRoutePath(path).startsWith("/en/") ? "en" : "th";
}

function placeholder(role: string): BoardExecutivePerson {
  return {
    name: "",
    role,
    imageSrc: null,
    imageAlt: "",
    email: null,
    vacant: true,
  };
}

function normalizeChart(
  title: string,
  people: BoardExecutivePerson[],
): BoardExecutiveOrgChart {
  return {
    title,
    director: people[0] ?? placeholder("ผู้อำนวยการ"),
    deputies: [
      people[1] ?? placeholder("รองผู้อำนวยการ"),
      people[2] ?? placeholder("รองผู้อำนวยการ"),
    ],
    generalManagers: [
      people[3] ?? placeholder("ผู้จัดการกลุ่มวิจัยและมาตรฐาน"),
      people[4] ?? placeholder("ผู้จัดการกลุ่มพัฒนาผู้ประกอบการและธุรกิจใหม่"),
      people[5] ?? placeholder("ผู้จัดการกลุ่มพัฒนาดิจิทัลระบบราง"),
      people[6] ?? placeholder("ผู้จัดการกลุ่มกลยุทธ์และสื่อสารองค์กร"),
      people[7] ?? placeholder("ผู้จัดการกลุ่มบริหารภายใน"),
    ],
  };
}

function buildSegments($: CheerioAPI, target: AnyNode): BoardExecutiveContentSegment[] {
  const segments: BoardExecutiveContentSegment[] = [];
  let html = "";

  for (const node of $.root().contents().toArray()) {
    if (node === target) {
      if (html.trim()) {
        segments.push({ kind: "html", html });
        html = "";
      }
      segments.push({ kind: "executiveChart" });
      continue;
    }

    html += $.html(node);
  }

  if (html.trim()) {
    segments.push({ kind: "html", html });
  }

  return segments;
}

export function isBoardExecutivePath(path: string): boolean {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return normalized === THAI_BOARD_PATH || normalized === ENGLISH_BOARD_PATH;
}

export function buildBoardExecutivePresentation(
  path: string,
  html: string,
): BoardExecutivePresentation | null {
  if (!isBoardExecutivePath(path)) {
    return null;
  }

  const $ = load(html, null, false);
  const accordion = $(".lightweight-accordion")
    .toArray()
    .find((element) =>
      isExecutiveTitle(compactText($(element).find("summary").first().text())),
    );

  if (!accordion) {
    return null;
  }

  const $accordion = $(accordion);
  const $details = $accordion.find("details").first();
  const title = compactText($accordion.find("summary").first().text());
  const people = $accordion
    .find(".lightweight-accordion-body .wp-block-column")
    .toArray()
    .map((element) => parsePerson($, element))
    .filter((person): person is BoardExecutivePerson => person !== null);

  if (people.length === 0) {
    return null;
  }

  return {
    language: languageFromPath(path),
    open: $details.attr("open") !== undefined,
    chart: normalizeChart(title, people),
    segments: buildSegments($, accordion),
  };
}
