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
  {
    slug: "manual-o20",
    path: "/คู่มือO20",
    title:
      "การขับเคลื่อนนโยบาย NO GIFT POLICY จากการปฏิบัติหน้าที่และการเสริมสร้างความรู้เกี่ยวกับหลักเกณฑ์การรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยาของเจ้าพนักงานของรัฐ",
    kind: "knowledge",
    groups: [
      {
        title:
          "การขับเคลื่อนนโยบาย NO GIFT POLICY จากการปฏิบัติหน้าที่และการเสริมสร้างความรู้เกี่ยวกับหลักเกณฑ์การรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยาของเจ้าพนักงานของรัฐ",
        open: true,
        documents: [
          pdfDocument(
            "o20หนังสือประกาศเจตนารมณ์ No Gift Policy ฉบับภาษาไทย",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o20-01-o20หนังสือประกาศเจตนารมณ์-No-Gift-Policy-ฉบับภาษาไทย.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/fde23d3c42688ef9.png",
          ),
          pdfDocument(
            "รายงานผลการดำเนินงานตามนโยบาย No Gift Policy 2568",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o20-02-รายงานผลการดำเนินงานตามนโยบาย-No-Gift-Policy-2568.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/f438c2d307853fd5.png",
          ),
          pdfDocument(
            "หลักเกณฑ์การรับทรัพย์สิน_ มาตรา 128",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o20-03-หลักเกณฑ์การรับทรัพย์สิน_-มาตรา-128.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/9d3c468accec1871.png",
          ),
        ],
      },
    ],
  },
  {
    slug: "manual-o13",
    path: "/คู่มือO13",
    title: "หลักเกณฑ์และแผนการบริหารและพัฒนาทรัพยากรบุคคล",
    kind: "knowledge",
    groups: [
      {
        title: "หลักเกณฑ์และแผนการบริหารและพัฒนาทรัพยากรบุคคล",
        open: true,
        documents: [
          pdfDocument(
            "1 หลักเกณฑ์สรรหา บรรจุ แต่งตั้ง",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-01-1-หลักเกณฑ์สรรหา-บรรจุ-แต่งตั้ง.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/43a5d643a411675d.png",
          ),
          pdfDocument(
            "o13 ข้อบังคับว่าด้วยการบริหารงานบุคคล",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-02-o13-ข้อบังคับว่าด้วยการบริหารงานบุคคล.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/28fcbcc8ca0a2a63.png",
          ),
          pdfDocument(
            "o13 แผนบริหารทรัพยากรบุคคล ปี 2569",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-03-o13-แผนบริหารทรัพยากรบุคคล-ปี-2569.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/6ccfdca31f0eafe4.png",
          ),
          pdfDocument(
            "o13 แผนพัฒนาทรัพยากรบุคคล ปี 2569",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-04-o13-แผนพัฒนาทรัพยากรบุคคล-ปี-2569.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/369a26cbf2f47cb3.png",
          ),
          pdfDocument(
            "o13_2 หลักเกณฑ์การเข้าสู่ตำแหน่ง ปรับระดับตำแหน่ง",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-05-o13_2-หลักเกณฑ์การเข้าสู่ตำแหน่ง-ปรับระดับตำแหน่ง.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/eb5b78a1f690054a.png",
          ),
          pdfDocument(
            "o13_3 หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติงาน",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-06-o13_3-หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติงาน.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/0d40052b47f038cf.png",
          ),
          pdfDocument(
            "o13_4 หลักเกณฑ์การปรับวุฒิและปรับอัตราค่าจ้างตามคุณวุฒิ",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o13-07-o13_4-หลักเกณฑ์การปรับวุฒิและปรับอัตราค่าจ้างตามคุณวุฒิ.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/d793348aca696184.png",
          ),
        ],
      },
    ],
  },
  {
    slug: "manual-o14",
    path: "/คู่มือO14",
    title: "รายงานผลการบริหารและพัฒนาทรัพยากรบุคคล",
    kind: "knowledge",
    groups: [
      {
        title: "รายงานผลการบริหารและพัฒนาทรัพยากรบุคคล",
        open: true,
        documents: [
          pdfDocument(
            "o14 รายงานผลการบริหารทรัพยากรบุคคล ประจำปีงบประมาณ2568(2)",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o14-01-o14-รายงานผลการบริหารทรัพยากรบุคคล-ประจำปีงบประมาณ2568-v2.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/68230638b3dc1ba4.png",
          ),
          pdfDocument(
            "o14 รายงานผลการพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ2568(2)",
            "/wp-content/uploads/landing-ita-guides-2569/manual-o14-02-o14-รายงานผลการพัฒนาทรัพยากรบุคคล-ประจำปีงบประมาณ2568-v2.pdf",
            "/wp-content/uploads/pdf-covers/landing-ita-guides-2569/e8ec51355f355717.png",
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
