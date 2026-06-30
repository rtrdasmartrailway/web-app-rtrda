import { normalizeRoutePath } from "./url";
import type { KnowledgeDocumentGroup } from "./knowledge-documents";

export type LandingGuidePageKind = "standalone-pdf" | "knowledge";

export interface LandingGuidePage {
  slug: string;
  path: string;
  title: string;
  kind: LandingGuidePageKind;
  groups: KnowledgeDocumentGroup[];
  pdfHref?: string;
}

function pdfDocument(title: string, href: string, coverImage: string | null) {
  return {
    title,
    description: "เอกสารเผยแพร่รูปแบบ PDF",
    coverImage,
    coverAlt: coverImage ? "หน้าแรกของ PDF" : "",
    previewHref: href,
    downloadHref: href,
    hasUsableTarget: true,
  };
}

export const landingGuidePages: LandingGuidePage[] = [
  {
    slug: "manual-o5",
    path: "/คู่มือO5",
    title: "แผนยุทธศาสตร์หรือแผนพัฒนาหน่วยงาน",
    kind: "standalone-pdf",
    pdfHref:
      "/wp-content/uploads/landing-ita-guides-2569/manual-o5-01-o5_แผนปฏิบัติการ-สทร.-ระยะ-5-ปี-2566-2570-งานแผนฯ.pdf",
    groups: [
      {
        title: "แผนยุทธศาสตร์หรือแผนพัฒนาหน่วยงาน",
        open: true,
        documents: [
          pdfDocument(
            "o5_แผนปฏิบัติการ สทร. ระยะ 5 ปี 2566-2570 (งานแผนฯ)",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o5-01-o5_แผนปฏิบัติการ-สทร.-ระยะ-5-ปี-2566-2570-งานแผนฯ.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/8a200728b8d645a2.png",
          ),
        ],
      },
    ],
  },
  {
    slug: "manual-o8",
    path: "/คู่มือO8",
    title: "คู่มือหรือแนวทางการปฏิบัติงานของเจ้าหน้าที่",
    kind: "knowledge",
    groups: [
      {
        title: "คู่มือหรือแนวทางการปฏิบัติงานของเจ้าหน้าที่",
        open: true,
        documents: [
          pdfDocument(
            "คู่มือ การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o8-01-คู่มือ-การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/532c76a70d69242d.png",
          ),
          pdfDocument(
            "คู่มือ การจัดการเรื่องร้องเรียนแจ้งเบาะแส",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o8-02-คู่มือ-การจัดการเรื่องร้องเรียนแจ้งเบาะแส.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/a846d3149147ff82.png",
          ),
          pdfDocument(
            "คู่มือการปฏิบัติงาน การรับ-ส่งหนังสือที่เป็นข้อมูลข่าวสารลับ",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o8-03-คู่มือการปฏิบัติงาน-การรับ-ส่งหนังสือที่เ.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/6ebbf8ce15a1bc33.png",
          ),
          pdfDocument(
            "คู่มือการปฏิบัติงานศูนย์ข้อมูลข่าวสาร สทร. ฉบับปรับปรุง พ.ศ. 2569",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o8-04-คู่มือการปฏิบัติงานศูนย์ข้อมูลข่าวสาร-สทร.-ฉบับปรับปรุง-พ.ศ.-2569.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/e680152608c3aab4.png",
          ),
        ],
      },
    ],
  },
  {
    slug: "manual-o9",
    path: "/คู่มือO9",
    title: "คู่มือหรือแนวทางการขอรับบริการสำหรับผู้รับบริการหรือผู้มาติดต่อ",
    kind: "knowledge",
    groups: [
      {
        title: "คู่มือหรือแนวทางการขอรับบริการสำหรับผู้รับบริการหรือผู้มาติดต่อ",
        open: true,
        documents: [
          pdfDocument(
            "PM-RTRDA-300-01-01 การให้บริการ Mobile Lab",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o9-01-o9_03_PM-RTRDA-300-01-01-การให้บริการMobile-Lab-v7-Final.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/cf0cdcae61154c7e.png",
          ),
          pdfDocument(
            "คู่มือการขอเข้าศึกษาดูงานสถาบันฯ",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o9-02-คู่มือการขอเข้าศึกษาดูงานสถาบันฯ.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/9db563a88d744551.png",
          ),
        ],
      },
    ],
  },
];

export function getLandingGuidePage(path: string): LandingGuidePage | null {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return landingGuidePages.find((page) => page.path === normalized) ?? null;
}
