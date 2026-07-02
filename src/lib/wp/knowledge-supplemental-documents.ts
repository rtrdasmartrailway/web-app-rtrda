import { normalizeRoutePath } from "./url";
import type { KnowledgeDocumentGroup } from "./knowledge-documents";

export interface SupplementalKnowledgePage {
  slug: string;
  path: string;
  title: string;
  groups: KnowledgeDocumentGroup[];
}

const basePath = "/บริการและข้อมูลสำคัญ";

const supplementalKnowledgeGroups: Array<{
  slug: string;
  group?: KnowledgeDocumentGroup;
  groups?: KnowledgeDocumentGroup[];
}> = [
  {
    slug: "ethics-code",
    group: {
      title: "ประมวลจริยะธรรม",
      open: true,
      documents: [
        {
          title: "o15 การลงนามปฏิญญาคุณธรรม",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/dd642cc79437cfb7.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-01-o15-การลงนามปฏิญญาคุณธรรม.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-01-o15-การลงนามปฏิญญาคุณธรรม.pdf",
          hasUsableTarget: true,
        },
        {
          title: "o15 กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/608b7ee0acfc2022.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-02-o15-กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-02-o15-กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ.pdf",
          hasUsableTarget: true,
        },
        {
          title: "o15 ข้อบังคับ คกก สทร ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน 2565",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/a008c4063597211b.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-03-o15-ข้อบังคับ-คกก-สทร-ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน-2565.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-03-o15-ข้อบังคับ-คกก-สทร-ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน-2565.pdf",
          hasUsableTarget: true,
        },
        {
          title: "o15 คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม 2569",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/1b7abb2efd3a3c44.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-04-o15-คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม-2569.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-04-o15-คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม-2569.pdf",
          hasUsableTarget: true,
        },
        {
          title: "o15 สื่อ DO and Dont RTRDA",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/5c4cf5fa51aaa6d3.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-05-o15-สื่อ-DO-and-Dont-RTRDA.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-05-o15-สื่อ-DO-and-Dont-RTRDA.pdf",
          hasUsableTarget: true,
        },
        {
          title: "o15_ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/cc7a154ec15f242e.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-06-o15_ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-06-o15_ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม.pdf",
          hasUsableTarget: true,
        },
        {
          title: "o15_ประมวลจริยธรรม",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/599cad509e399869.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-07-o15_ประมวลจริยธรรม.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/ethics-code-07-o15_ประมวลจริยธรรม.pdf",
          hasUsableTarget: true,
        },
      ],
    },
  },
  {
    slug: "complaint-practice",
    group: {
      title: "แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
      open: true,
      documents: [
        {
          title: "o 16 แนวทางปฏิบัติ การจัดการเรื่องร้องเรียน",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/167cd334b39393ea.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/complaint-practice-01-o-16-แนวทางปฏิบัติ-การจัดการเรื่องร้องเรียน.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/complaint-practice-01-o-16-แนวทางปฏิบัติ-การจัดการเรื่องร้องเรียน.pdf",
          hasUsableTarget: true,
        },
      ],
    },
  },
  {
    slug: "complaint-statistics",
    group: {
      title: "ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
      open: true,
      documents: [
        {
          title: "รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร",
          description: "เอกสารเผยแพร่รูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/5b9929a8bbf4fec1.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/complaint-statistics-01-รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/complaint-statistics-01-รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.pdf",
          hasUsableTarget: true,
        },
        {
          title: "รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร (XLSX)",
          description: "ไฟล์ตารางข้อมูลสถิติเรื่องร้องเรียนรูปแบบ XLSX",
          coverImage: null,
          coverAlt: "ไฟล์ XLSX",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/complaint-statistics-02-report.xlsx",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/complaint-statistics-02-report.xlsx",
          hasUsableTarget: true,
        },
      ],
    },
  },
  {
    slug: "participation-results",
    group: {
      title: "ผลการเปิดโอกาสให้มีส่วนร่วมในการดำเนินงาน",
      open: true,
      documents: [
        {
          title: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/c8445c50ef7acf1d.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-01-เอกสารประกอบที่-1-คำสั่งสทรที่52-2568.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-01-เอกสารประกอบที่-1-คำสั่งสทรที่52-2568.pdf",
          hasUsableTarget: true,
        },
        {
          title: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/5a6f76f392e5f195.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-02-เอกสารประกอบที่-2-รายงานประชุม-ครั้งที่-4-2568.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-02-เอกสารประกอบที่-2-รายงานประชุม-ครั้งที่-4-2568.pdf",
          hasUsableTarget: true,
        },
        {
          title: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/a049a64d01ea7cf6.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-03-เอกสารประกอบที่-3-สรุปการประชุมTechnical-Hearing.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-03-เอกสารประกอบที่-3-สรุปการประชุมTechnical-Hearing.pdf",
          hasUsableTarget: true,
        },
        {
          title: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/16cde50cc8bef61e.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-04-เอกสารประกอบที่-4-รายงานประชุม-ครั้งที่-10-2568.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-04-เอกสารประกอบที่-4-รายงานประชุม-ครั้งที่-10-2568.pdf",
          hasUsableTarget: true,
        },
        {
          title: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/d2b356be426df4bf.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-05-เอกสารประกอบที่-5-รายงานการประชุม-ครั้งที่-26-4-2568.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-05-เอกสารประกอบที่-5-รายงานการประชุม-ครั้งที่-26-4-2568.pdf",
          hasUsableTarget: true,
        },
        {
          title: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/d76648bbbc93a6d6.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-06-เอกสารประกอบที่-6-รายงานการจัดทำประชาพิจารณ์.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-06-เอกสารประกอบที่-6-รายงานการจัดทำประชาพิจารณ์.pdf",
          hasUsableTarget: true,
        },
        {
          title: "แบบฟอร์มการมีส่วนร่วมo19_v3",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/881e689093f05ec1.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-07-แบบฟอร์มการมีส่วนร่วมo19_v3.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-07-แบบฟอร์มการมีส่วนร่วมo19_v3.pdf",
          hasUsableTarget: true,
        },
        {
          title: "รายงานผลการเปิดโอกาสให้บุคคลภายนอกได้มีส่วนร่วม",
          description: "เอกสารประกอบและรายงานผลการมีส่วนร่วมรูปแบบ PDF",
          coverImage:
            "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/5fffd335dd35903b.png",
          coverAlt: "หน้าแรกของ PDF",
          previewHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-08-รายงานผลการเปิดโอกาสให้บุคคลภายนอกได้มีส่วนร่วม.pdf",
          downloadHref:
            "/wp-content/uploads/knowledge-ethics-2569/participation-results-08-รายงานผลการเปิดโอกาสให้บุคคลภายนอกได้มีส่วนร่วม.pdf",
          hasUsableTarget: true,
        },
      ],
    },
  },
  {
    slug: "procurement-summary",
    groups: [
      {
        title:
          "O 11 รายงานสรุปผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุของหน่วยงาน ประจำปีงบประมาณ พ.ศ.2569 (แบบ สขร.1)",
        open: true,
        documents: [
          {
            title: "O11 ไตรมาสที่ 1",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/7f6e21d84ae3e008.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-01-O11-ไตรมาสที่-1.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-01-O11-ไตรมาสที่-1.pdf",
            hasUsableTarget: true,
          },
          {
            title: "O11 ไตรมาสที่ 1 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-01-O11-ไตรมาสที่-1.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-01-O11-ไตรมาสที่-1.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "O11 ไตรมาสที่ 2",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/6fff542c10bb96a2.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-02-O11-ไตรมาสที่-2.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-02-O11-ไตรมาสที่-2.pdf",
            hasUsableTarget: true,
          },
          {
            title: "O11 ไตรมาสที่ 2 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-02-O11-ไตรมาสที่-2.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-02-O11-ไตรมาสที่-2.xlsx",
            hasUsableTarget: true,
          },
        ],
      },
      {
        title:
          "O 12 รายงานสรุปผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุของหน่วยงาน ประจำปีงบประมาณ พ.ศ.2568 (แบบ สขร.1)",
        open: true,
        documents: [
          {
            title: "1.สขร.เดือน ตุลาคม 2567",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/6f84e1f0201f35a3.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-03-1.สขร.เดือน-ตุลาคม-2567.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-03-1.สขร.เดือน-ตุลาคม-2567.pdf",
            hasUsableTarget: true,
          },
          {
            title: "1.สขร.เดือน ตุลาคม 2567 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-03-1.สขร.เดือน-ตุลาคม-2567.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-03-1.สขร.เดือน-ตุลาคม-2567.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "2..สขร.เดือน พฤศจิกายน 2567",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/5f412f5d64d81cd1.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-07-2..สขร.เดือน-พฤศจิกายน-2567.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-07-2..สขร.เดือน-พฤศจิกายน-2567.pdf",
            hasUsableTarget: true,
          },
          {
            title: "2.สขร.เดือน พฤศจิกายน 2567 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-07-2.สขร.เดือน-พฤศจิกายน-2567.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-07-2.สขร.เดือน-พฤศจิกายน-2567.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "3.สขร. เดือน ธันวาคม2567",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/3b734060f126d5cc.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-08-3.สขร.-เดือน-ธันวาคม2567.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-08-3.สขร.-เดือน-ธันวาคม2567.pdf",
            hasUsableTarget: true,
          },
          {
            title: "3.สขร.เดือน ธันวาคม 2567 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-08-3.สขร.เดือน-ธันวาคม-2567.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-08-3.สขร.เดือน-ธันวาคม-2567.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "4.สขร.เดือน มกราคม 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/dc4a2fd8656faa63.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-09-4.สขร.เดือน-มกราคม-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-09-4.สขร.เดือน-มกราคม-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "4.สขร.เดือน มกราคม 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-09-4.สขร.เดือน-มกราคม-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-09-4.สขร.เดือน-มกราคม-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "5.สขร.เดือน กุมภาพันธ์ 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/cabbdb5d8e2e252d.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-10-5.สขร.เดือน-กุมภาพันธ์-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-10-5.สขร.เดือน-กุมภาพันธ์-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "5.สขร.เดือน กุมภาพันธ์ 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-10-5.-สขร.เดือน-กุมภาพันธ์-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-10-5.-สขร.เดือน-กุมภาพันธ์-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "6.สขร เดือน มีนาคม 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/c047b4413c1be50e.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-11-6.สขร-เดือน-มีนาคม-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-11-6.สขร-เดือน-มีนาคม-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "6.สขร เดือน มีนาคม 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-11-6.สขร-เดือน-มีนาคม-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-11-6.สขร-เดือน-มีนาคม-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "7.สขร เดือน เมษายน 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/1c27347be82546e2.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-12-7.สขร-เดือน-เมษายน-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-12-7.สขร-เดือน-เมษายน-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "7.สขร เดือน เมษายน 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-12-7.-สขร.เดือน-เมษายน-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-12-7.-สขร.เดือน-เมษายน-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "8.สขร เดือน พฤษภาคม 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/e6ae700e5e496913.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-13-8.สขร-เดือน-พฤษภาคม-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-13-8.สขร-เดือน-พฤษภาคม-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "8.สขร เดือน พฤษภาคม 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-13-8.สขร-เดือน-พฤษภาคม-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-13-8.สขร-เดือน-พฤษภาคม-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "9.สขร เดือน มิถุนายน 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/ffdbcddfeff02d43.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-14-9.สขร-เดือน-มิถุนายน-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-14-9.สขร-เดือน-มิถุนายน-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "9.สขร เดือน มิถุนายน 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-14-9.สขร-เดือน-มิถุนายน-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-14-9.สขร-เดือน-มิถุนายน-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "10.สขร เดือน กรกฎาคม 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/04186c2af34acffd.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-04-10.สขร-เดือน-กรกฎาคม-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-04-10.สขร-เดือน-กรกฎาคม-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "10.สขร เดือน กรกฎาคม 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-04-10.สขร-เดือน-กรกฎาคม-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-04-10.สขร-เดือน-กรกฎาคม-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "11.สขร เดือน สิงหาคม 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/45a41bd85604f8f5.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-05-11.สขร-เดือน-สิงหาคม-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-05-11.สขร-เดือน-สิงหาคม-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "11.สขร เดือน สิงหาคม 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-05-11.สขร-เดือน-สิงหาคม-2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-05-11.สขร-เดือน-สิงหาคม-2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "12.สขร.เดือน กันยายน 2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/550413f08ebe5fdf.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-06-12.สขร.เดือน-กันยายน-2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-06-12.สขร.เดือน-กันยายน-2568.pdf",
            hasUsableTarget: true,
          },
          {
            title: "12.สขร. เดือน กันยายน 2568 (XLSX)",
            description: "ไฟล์ตารางสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ XLSX",
            coverImage: null,
            coverAlt: "ไฟล์ XLSX",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-06-12.สขร.-เดือน-กันยายน2568.xlsx",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-xlsx-06-12.สขร.-เดือน-กันยายน2568.xlsx",
            hasUsableTarget: true,
          },
          {
            title: "แบบสรุปผลการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ.2568",
            description: "เอกสารสรุปข้อมูลจัดซื้อจัดจ้างรูปแบบ PDF",
            coverImage:
              "/wp-content/uploads/pdf-covers/knowledge-ethics-2569/c0f9863b46cfff4f.png",
            coverAlt: "หน้าแรกของ PDF",
            previewHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-15-แบบสรุปผลการจัดซื้อจัดจ้าง-ประจำปีงบประมาณ-พ.ศ.2568.pdf",
            downloadHref:
              "/wp-content/uploads/knowledge-ethics-2569/procurement-summary-15-แบบสรุปผลการจัดซื้อจัดจ้าง-ประจำปีงบประมาณ-พ.ศ.2568.pdf",
            hasUsableTarget: true,
          },
        ],
      },
    ],
  },
];

export const supplementalKnowledgePages: SupplementalKnowledgePage[] =
  supplementalKnowledgeGroups.map(({ slug, group, groups }) => {
    const resolvedGroups = groups ?? (group ? [group] : []);
    const title = resolvedGroups[0]?.title ?? slug;

    return {
      slug,
      path: `${basePath}/${slug}`,
      title: slug === "procurement-summary" ? "สรุปจัดซื้อจัดจ้าง" : title,
      groups: resolvedGroups,
    };
  });

export function getSupplementalKnowledgePage(
  path: string,
): SupplementalKnowledgePage | null {
  const normalized = normalizeRoutePath(path).normalize("NFC");
  return supplementalKnowledgePages.find((page) => page.path === normalized) ?? null;
}
