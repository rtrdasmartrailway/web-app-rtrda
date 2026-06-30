import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { WpContentRecord } from "./types";

const THAI_ITA_PAGE_ID = "th-page-4837";

export const ITA_HEADING_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  ["O1 โครงสร้างและอำนาจหน้าที่", "O1 โครงสร้าง หน้าที่และอำนาจ"],
  ["O3 ข้อมูลการติดต่อ", "O3 ข้อมูลการติดต่อและช่องทางการสอบถาม"],
  ["O10 E–Service", "O10 ระบบการให้บริการผ่านช่องทางออนไลน์ (E-SERVICE)"],
  [
    "O11 ข้อมูลสถิติการให้บริการ",
    "O11 สรุปผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุรายเดือน ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O12 รายการการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ และความก้าวหน้าการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ",
    "O12 รายงานสรุปผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุของหน่วยงาน ประจำปีงบประมาณ พ.ศ. 2568",
  ],
  [
    "O13 รายงานผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุประจำปี พ.ศ. 2568",
    "O13 หลักเกณฑ์และแผนการบริหารและพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O14 แผนการบริหารและพัฒนาทรัพยากรบุคคลประจำปีงบประมาณ พ.ศ. 2569",
    "O14 รายงานผลการบริหารและพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ พ.ศ. 2568",
  ],
  [
    "O15 รายงานผลการบริหารและพัฒนาทรัพยากรบุคคลประจำปี พ.ศ. 2568",
    "O15 ประมวลจริยธรรมการขับเคลื่อนจริยธรรม",
  ],
  [
    "O16 ประมวลจริยธรรมและการขับเคลื่อนจริยธรรม",
    "O16 แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
  ],
  [
    "O17 แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    "O17 ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
  ],
  [
    "O18 ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    "O18 ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ ประจำปีงบประมาณ พ.ศ..2568",
  ],
  [
    "O19 ข้อมูลสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ ประจำปี พ.ศ. 2568",
    "O19 ผลการเปิดโอกาสให้มีส่วนร่วมในการดำเนินงาน ปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O20 การเปิดโอกาสให้เกิดการมีส่วนร่วม",
    "O20 การขับเคลื่อนนโยบาย NO GIFT POLICY จากการปฏิบัติหน้าที่และการเสริมสร้างความรู้เกี่ยวกับหลักเกณฑ์การรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยาของเจ้าพนักงานของรัฐ",
  ],
  [
    "O21 ประกาศเจตนารมณ์และการสร้างวัฒนธรรม ตามนโยบาย No Gift Policy จากการปฏิบัติหน้าที่",
    "O21 การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ ประจำปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O22 รายงานการรับทรัพย์สินหรือประโยชน์อื่นใดโดยธรรมจรรยา",
    "O22 รายงานผลการดำเนินการตามแผนบริหารจัดการความเสี่ยงการทุจริตของหน่วยงาน ประจำปีงบประมาณ พ.ศ. 2568",
  ],
  [
    "O23 การประเมินความเสี่ยงที่อาจเกิดการให้หรือรับสินบนจากการดำเนินงานตามภารกิจของหน่วยงานประจำปี พ.ศ. 2569",
    "O23 แผนปฏิบัติการป้องกันการทุจริต ปีงบประมาณ พ.ศ. 2569",
  ],
  [
    "O24 รายงานผลการดำเนินการเพื่อจัดการความเสี่ยงการทุจริตและประพฤติมิชอบประจำปี พ.ศ. 2568",
    "O24 รายงานผลการดำเนินการป้องกันการทุจริต ปีงบประมาณ พ.ศ.. 2568",
  ],
  [
    "O25 แผนปฏิบัติการป้องกันปราบปรามการทุจริตและประพฤติมิชอบ และส่งเสริมคุณธรรมจริยธรรมของกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2569",
    "O25 การนำผลการประเมิน ITA ไปสู่การพัฒนาองค์กร",
  ],
  [
    "O26 รายงานผลการดำเนินงานตามแผนปฏิบัติการป้องกันปราบปรามการทุจริตและประพฤติมิชอบ และส่งเสริมคุณธรรมจริยธรรมของกระทรวงคมนาคม ประจำปีงบประมาณ พ.ศ. 2568",
    "O26 รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรมและความโปร่งใสภายในหน่วยงานปีงบประมาณ พ.ศ.. 2568",
  ],
];

const ITA_O19_NEWS_TITLE =
  "สทร. จัดประชุมเทคนิคพิจารณ์ ร่าง มาตรฐานหมอนคอนกรีตและอุปกรณ์ยึดเหนี่ยวราง ครั้งที่ 1/2568 มุ่งยกระดับคุณภาพและความปลอดภัยของระบบรางไทยสู่ระดับสากล";

const ITA_O10_E_SERVICE_STATS_HREF =
  "/wp-content/uploads/ita2569/O10/ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์(E-service).pdf";

const ITA_O8_UPLOAD_DIR = "/wp-content/uploads/ita2569/O8";
const ITA_O9_UPLOAD_DIR = "/wp-content/uploads/ita2569/O9";
const ITA_O11_UPLOAD_DIR = "/wp-content/uploads/ita2569/O11";
const ITA_O12_UPLOAD_DIR = "/wp-content/uploads/ita2569/O12";
const ITA_O13_UPLOAD_DIR = "/wp-content/uploads/ita2569/O13";
const ITA_O14_UPLOAD_DIR = "/wp-content/uploads/ita2569/O14";
const ITA_O15_UPLOAD_DIR = "/wp-content/uploads/ita2569/O15";
const ITA_O16_UPLOAD_DIR = "/wp-content/uploads/ita2569/O16";
const ITA_O18_UPLOAD_DIR = "/wp-content/uploads/ita2569/O18";
const ITA_O25_UPLOAD_DIR = "/wp-content/uploads/ita2569/O25";
const ITA_O26_UPLOAD_DIR = "/wp-content/uploads/ita2569/O26";

const ITA_O4_NEWS_HREF = "/category/ข่าวและกิจกรรม";
const ITA_O4_ITA_NEWS_HREF =
  "/สทร-เดินหน้ายกระดับองค์กรโปร่งใส-จัดโครงการพัฒนาและเพิ่มประสิทธิภาพการประเมิน-ITA-ประจำปี-2569";

const ITA_LINK_OVERRIDES: ReadonlyArray<{
  marker: string;
  links: ReadonlyArray<{ title: string; href: string; indent?: boolean }>;
}> = [
  {
    marker: "O1",
    links: [
      {
        title: "โครงสร้าง",
        href: "/เกี่ยวกับ-สทร/โครงสร้างองค์กร",
      },
      {
        title: "หน้าที่และอำนาจ",
        href: "/วัตถุประสงค์การจัดตั้ง",
      },
      {
        title:
          "พระราชกฤษฎีการจัดตั้งสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) พ.ศ.2564",
        href: "/wp-content/uploads/2023/04/พระราชกฤษฎีการจัดตั้งสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง-องค์การมหาชน-พ.ศ.2564.pdf",
      },
    ],
  },
  {
    marker: "O3",
    links: [
      {
        title: "ช่องทางการติดต่อ",
        href: "/ติดต่อเรา/ช่องทางการติดต่อ",
      },
      {
        title: "ข้อมูลการติดต่อ",
        href: "https://maps.app.goo.gl/w61dRrWtu8ut8688A",
      },
    ],
  },
  {
    marker: "O4",
    links: [
      {
        title: "ข่าวประชาสัมพันธ์",
        href: ITA_O4_NEWS_HREF,
      },
      {
        title:
          "สทร. เดินหน้ายกระดับองค์กรโปร่งใส จัดโครงการพัฒนาและเพิ่มประสิทธิภาพการประเมิน ITA ประจำปี 2569",
        href: ITA_O4_ITA_NEWS_HREF,
      },
    ],
  },
  {
    marker: "O8",
    links: [
      {
        title: "คู่มือการปฏิบัติงาน การรับ-ส่งหนังสือที่เป็นข้อมูลข่าวสารลับ",
        href: `${ITA_O8_UPLOAD_DIR}/o8-01-คู่มือการปฏิบัติงาน-การรับ-ส่งหนังสือที่เ.pdf`,
      },
      {
        title: "คู่มือ การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
        href: `${ITA_O8_UPLOAD_DIR}/o8-02-คู่มือ-การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ.pdf`,
      },
      {
        title: "คู่มือ การจัดการเรื่องร้องเรียนแจ้งเบาะแส",
        href: `${ITA_O8_UPLOAD_DIR}/o8-03-คู่มือ-การจัดการเรื่องร้องเรียนแจ้งเบาะแส.pdf`,
      },
      {
        title: "คู่มือการปฏิบัติงานศูนย์ข้อมูลข่าวสาร สทร. (ฉบับปรับปรุง พ.ศ. 2569)",
        href: `${ITA_O8_UPLOAD_DIR}/o8-04-คู่มือการปฏิบัติงานศูนย์ข้อมูลข่าวสาร-สทร.-ฉบับปรับปรุง-พ.ศ.-2569.pdf`,
      },
    ],
  },
  {
    marker: "O9",
    links: [
      {
        title: "คู่มือการให้บริการการยืมครุภัณฑ์บุคคลภายนอก",
        href: `${ITA_O9_UPLOAD_DIR}/09คู่มือ_การยืมทรัพย์สินทางราชการ_บุคคลภาย.pdf`,
      },
      {
        title: "คู่มือการให้บริการข้อมูลข่าวสารของ สทร. (ฉบับปรับปรุง)",
        href: `${ITA_O9_UPLOAD_DIR}/09คู่มือการให้บริการข้อมูลข่าวสารของ_สทร._.pdf`,
      },
      {
        title: "คู่มือการขอเข้าศึกษาดูงานสถาบันฯ",
        href: sdcDownloadInlineHref("ita2569-o9-03"),
      },
    ],
  },
  {
    marker: "O10",
    links: [
      {
        title: "ข้อมูลสถิติการขอรับบริการผ่านช่องทางออนไลน์(E-service)",
        href: ITA_O10_E_SERVICE_STATS_HREF,
      },
      {
        title: "คู่มือการให้บริการ-E-Service",
        href: "/wp-content/uploads/ita2569/O10/o10-คู่มือการให้บริการ-E-Service.pdf",
      },
      {
        title: "E-Service",
        href: "/e-services",
      },
    ],
  },
  {
    marker: "O11",
    links: [
      {
        title: "O11 ไตรมาสที่ 1",
        href: `${ITA_O11_UPLOAD_DIR}/O11_ไตรมาสที่_1.pdf`,
      },
      {
        title: "O11 ไตรมาสที่ 1 (Excel)",
        href: `${ITA_O11_UPLOAD_DIR}/O11_ไตรมาสที่_1.xlsx`,
      },
      {
        title: "O11 ไตรมาสที่ 2",
        href: `${ITA_O11_UPLOAD_DIR}/O11_ไตรมาสที่_2.pdf`,
      },
      {
        title: "O11 ไตรมาสที่ 2 (Excel)",
        href: `${ITA_O11_UPLOAD_DIR}/O11_ไตรมาสที่_2.xlsx`,
      },
    ],
  },
  {
    marker: "O12",
    links: [
      {
        title: "แบบสรุปผลการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ.2568",
        href: itaO12Href("แบบสรุปผลการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ.2568.pdf"),
      },
      {
        title: "12.สขร.เดือน กันยายน 2568",
        href: itaO12Href("12.สขร.เดือน กันยายน 2568.pdf"),
      },
      {
        title: "12.สขร. เดือน กันยายน2568",
        href: itaO12Href("12.สขร. เดือน กันยายน2568.xlsx"),
      },
      {
        title: "11.สขร เดือน สิงหาคม 2568",
        href: itaO12Href("11.สขร เดือน สิงหาคม 2568.pdf"),
      },
      {
        title: "11.สขร เดือน สิงหาคม 2568",
        href: itaO12Href("11.สขร เดือน สิงหาคม 2568.xlsx"),
      },
      {
        title: "10.สขร เดือน กรกฎาคม 2568",
        href: itaO12Href("10.สขร เดือน กรกฎาคม 2568.pdf"),
      },
      {
        title: "10.สขร เดือน กรกฎาคม 2568",
        href: itaO12Href("10.สขร เดือน กรกฎาคม 2568.xlsx"),
      },
      {
        title: "9.สขร เดือน มิถุนายน 2568",
        href: itaO12Href("9.สขร เดือน มิถุนายน 2568.pdf"),
      },
      {
        title: "9.สขร เดือน มิถุนายน 2568",
        href: itaO12Href("9.สขร เดือน มิถุนายน 2568.xlsx"),
      },
      {
        title: "8.สขร เดือน พฤษภาคม 2568",
        href: itaO12Href("8.สขร เดือน พฤษภาคม 2568.pdf"),
      },
      {
        title: "8.สขร เดือน พฤษภาคม 2568",
        href: itaO12Href("8.สขร เดือน พฤษภาคม 2568.xlsx"),
      },
      {
        title: "7.สขร เดือน เมษายน 2568",
        href: itaO12Href("7.สขร เดือน เมษายน 2568.pdf"),
      },
      {
        title: "7. สขร.เดือน เมษายน 2568",
        href: itaO12Href("7. สขร.เดือน เมษายน 2568.xlsx"),
      },
      {
        title: "6.สขร เดือน มีนาคม 2568",
        href: itaO12Href("6.สขร เดือน มีนาคม 2568.pdf"),
      },
      {
        title: "6.สขร เดือน มีนาคม 2568",
        href: itaO12Href("6.สขร เดือน มีนาคม 2568.xlsx"),
      },
      {
        title: "5.สขร.เดือน กุมภาพันธ์ 2568",
        href: itaO12Href("5.สขร.เดือน กุมภาพันธ์ 2568.pdf"),
      },
      {
        title: "5. สขร.เดือน กุมภาพันธ์ 2568",
        href: itaO12Href("5. สขร.เดือน กุมภาพันธ์ 2568.xlsx"),
      },
      {
        title: "4.สขร.เดือน มกราคม 2568",
        href: itaO12Href("4.สขร.เดือน มกราคม 2568.pdf"),
      },
      {
        title: "4.สขร.เดือน มกราคม 2568",
        href: itaO12Href("4.สขร.เดือน มกราคม 2568.xlsx"),
      },
      {
        title: "3.สขร. เดือน ธันวาคม2567",
        href: itaO12Href("3.สขร. เดือน ธันวาคม2567.pdf"),
      },
      {
        title: "3.สขร.เดือน ธันวาคม 2567",
        href: itaO12Href("3.สขร.เดือน ธันวาคม 2567.xlsx"),
      },
      {
        title: "2..สขร.เดือน พฤศจิกายน 2567",
        href: itaO12Href("2..สขร.เดือน พฤศจิกายน 2567.pdf"),
      },
      {
        title: "2.สขร.เดือน พฤศจิกายน 2567",
        href: itaO12Href("2.สขร.เดือน พฤศจิกายน 2567.xlsx"),
      },
      {
        title: "1.สขร.เดือน ตุลาคม 2567",
        href: itaO12Href("1.สขร.เดือน ตุลาคม 2567.pdf"),
      },
      {
        title: "1.สขร.เดือน ตุลาคม 2567",
        href: itaO12Href("1.สขร.เดือน ตุลาคม 2567.xlsx"),
      },
    ],
  },
  {
    marker: "O13",
    links: [
      {
        title: "ข้อบังคับว่าด้วยการบริหารงานบุคคล",
        href: `${ITA_O13_UPLOAD_DIR}/o13_ข้อบังคับว่าด้วยการบริหารงานบุคคล.pdf`,
      },
      {
        title: "หลักเกณฑ์สรรหา บรรจุ แต่งตั้ง",
        href: `${ITA_O13_UPLOAD_DIR}/o13_หลักเกณฑ์สรรหา_บรรจุ_แต่งตั้ง.pdf`,
      },
      {
        title: "หลักเกณฑ์การเข้าสู่ตำแหน่ง ปรับระดับตำแหน่ง",
        href: `${ITA_O13_UPLOAD_DIR}/o13_2_หลักเกณฑ์การเข้าสู่ตำแหน่ง_ปรับระดับตำแหน่ง.pdf`,
      },
      {
        title: "หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติงาน",
        href: `${ITA_O13_UPLOAD_DIR}/o13_3_หลักเกณฑ์และวิธีการประเมินผลการปฏิบัติงาน.pdf`,
      },
      {
        title: "หลักเกณฑ์การปรับวุฒิและปรับอัตราค่าจ้างตามคุณวุฒิ",
        href: `${ITA_O13_UPLOAD_DIR}/o13_4_หลักเกณฑ์การปรับวุฒิและปรับอัตราค่าจ้างตามคุณวุฒิ.pdf`,
      },
      {
        title: "แผนบริหารทรัพยากรบุคคล ปี 2569",
        href: `${ITA_O13_UPLOAD_DIR}/o13_แผนบริหารทรัพยากรบุคคล_ปี_2569.pdf`,
      },
      {
        title: "แผนพัฒนาทรัพยากรบุคคล ปี 2569",
        href: `${ITA_O13_UPLOAD_DIR}/o13_แผนพัฒนาทรัพยากรบุคคล_ปี_2569.pdf`,
      },
    ],
  },
  {
    marker: "O14",
    links: [
      {
        title: "รายงานผลการบริหารทรัพยากรบุคคล ประจำปีงบประมาณ 2568",
        href: `${ITA_O14_UPLOAD_DIR}/o14_รายงานผลการบริหารทรัพยากรบุคคล_ประจำปีงบประมาณ2568(2).pdf`,
      },
      {
        title: "รายงานผลการพัฒนาทรัพยากรบุคคล ประจำปีงบประมาณ 2568",
        href: `${ITA_O14_UPLOAD_DIR}/o14_รายงานผลการพัฒนาทรัพยากรบุคคล_ประจำปีงบประมาณ2568(2).pdf`,
      },
    ],
  },
  {
    marker: "O15",
    links: [
      {
        title: "o15 การลงนามปฏิญญาคุณธรรม",
        href: `${ITA_O15_UPLOAD_DIR}/o15_การลงนามปฏิญญาคุณธรรม.pdf`,
      },
      {
        title: "o15 กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ",
        href: `${ITA_O15_UPLOAD_DIR}/o15_กิจกรรมอบรมสอดแทรกสาระด้านจริยธรรมฯ.pdf`,
      },
      {
        title: "o15 ข้อบังคับ คกก สทร ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน 2565",
        href: `${ITA_O15_UPLOAD_DIR}/o15_ข้อบังคับ_คกก_สทร_ว่าด้วยประมวลจริยธรรมในการปฏิบัติงาน_2565.pdf`,
      },
      {
        title: "o15 คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม 2569",
        href: `${ITA_O15_UPLOAD_DIR}/o15_คำสั่งแต่งตั้งคณะทำงานขับเคลื่อนจริยธรรม_2569.pdf`,
      },
      {
        title: "o15 สรุปสาระสำคัญ มาตรา 128 Infographic",
        href: `${ITA_O15_UPLOAD_DIR}/o15_สรุปสาระสำคัญ_มาตรา_128_Infographic.png`,
      },
      {
        title: "o15 สื่อ DO and Dont RTRDA",
        href: `${ITA_O15_UPLOAD_DIR}/o15_สื่อ_DO_and_Dont_RTRDA.pdf`,
      },
      {
        title: "o15 ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม",
        href: `${ITA_O15_UPLOAD_DIR}/o15_ข้อกำหนดว่าด้วยกระบวนการรักษาจริยธรรม.pdf`,
      },
      {
        title: "o15 ประมวลจริยธรรม",
        href: `${ITA_O15_UPLOAD_DIR}/o15_ประมวลจริยธรรม.pdf`,
      },
    ],
  },
  {
    marker: "O16",
    links: [
      {
        title: "o 16 แนวทางปฏิบัติ การจัดการเรื่องร้องเรียน",
        href: `${ITA_O16_UPLOAD_DIR}/o_16_แนวทางปฏิบัติ_การจัดการเรื่องร้องเรียน.pdf`,
      },
    ],
  },
  {
    marker: "O17",
    links: [
      {
        title: "ช่องทางแจ้งเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
        href: "https://test.rtrda.or.th/%E0%B8%8A%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%97%E0%B8%B2%E0%B8%87%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%81%E0%B8%88%E0%B9%89%E0%B8%87%E0%B9%80%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%81%E0%B8%B2",
      },
      {
        title: "ช่องทางแจ้งร้องเรียนฯ สำนักงาน ป.ป.ช.",
        href: "https://wbs.nacc.go.th/",
      },
      {
        title: "ช่องทางแจ้งร้องเรียนฯ สำนักงาน ป.ป.ท.",
        href: "https://www.pacc.go.th/e-service/index.html",
      },
    ],
  },
  {
    marker: "O18",
    links: [
      {
        title: "รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร",
        href: `${ITA_O18_UPLOAD_DIR}/รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.pdf`,
      },
      {
        title: "รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร (Excel)",
        href: `${ITA_O18_UPLOAD_DIR}/รายงานข้อมูลสถิติเรื่องร้องเรียนการทุจร.xlsx`,
      },
    ],
  },
  {
    marker: "O19",
    links: [
      {
        title: ITA_O19_NEWS_TITLE,
        href: "https://test.rtrda.or.th/สทร-จัดประชุมเทคนิคพิจ-3/",
      },
      {
        title: "แบบฟอร์มการมีส่วนร่วมo19_v3",
        href: sdcDownloadHref("ita2569-o19-01"),
        indent: true,
      },
      {
        title: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568",
        href: sdcDownloadHref("ita2569-o19-02"),
        indent: true,
      },
      {
        title: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568",
        href: sdcDownloadHref("ita2569-o19-03"),
        indent: true,
      },
      {
        title: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing",
        href: sdcDownloadHref("ita2569-o19-04"),
        indent: true,
      },
      {
        title: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568",
        href: sdcDownloadHref("ita2569-o19-05"),
        indent: true,
      },
      {
        title: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568",
        href: sdcDownloadHref("ita2569-o19-06"),
        indent: true,
      },
      {
        title: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์",
        href: sdcDownloadHref("ita2569-o19-07"),
        indent: true,
      },
      {
        title: "รายงานผลการเปิดโอกาสให้บุคคลภายนอกได้มีส่วนร่วม",
        href: sdcDownloadHref("ita2569-o19-08"),
      },
    ],
  },
  {
    marker: "O20",
    links: [
      {
        title:
          "สทร.ร่วมประกาศเจตนารมณ์การต่อต้านการทุจริตคอร์รัปชันในองค์กร การไม่รับของขวัญ (No Gift Policy)",
        href: "https://test.rtrda.or.th/%E0%B8%AA%E0%B8%97%E0%B8%A3-%E0%B8%A3%E0%B9%88%E0%B8%A7%E0%B8%A1%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A8%E0%B9%80%E0%B8%88%E0%B8%95%E0%B8%99%E0%B8%B2%E0%B8%A3%E0%B8%A1%E0%B8%93%E0%B9%8C-no-gift-policy-2569",
      },
      {
        title: 'หนังสือประกาศเจตนารมณ์ No Gift Policy "ฉบับภาษาไทยและภาษาอังกฤษ"',
        href: sdcDownloadInlineHref("ita2569-o20-01"),
      },
      {
        title: "รายงานผลการดำเนินงานตามนโยบาย No Gift Policy 2568",
        href: sdcDownloadInlineHref("ita2569-o20-02"),
      },
      {
        title: "หลักเกณฑ์การรับทรัพย์สิน มาตรา 128",
        href: sdcDownloadInlineHref("ita2569-o20-03"),
      },
    ],
  },
  {
    marker: "O21",
    links: [
      {
        title: "การประเมินความเสี่ยงการทุจริตในหน่วยงานภาครัฐ ประจำปีงบประมาณ พ.ศ. 2569",
        href: sdcDownloadHref("ita2569-o21-01"),
      },
      {
        title: "ประเมินความเสี่ยงด้านการทุจริตฯ ด้านการเบิกจ่ายเงินงบประมาณ",
        href: sdcDownloadHref("ita2569-o21-02"),
      },
    ],
  },
  {
    marker: "O22",
    links: [
      {
        title: "รายงานผลด้านการใช้อำนาจตำแหน่งหน้าที่",
        href: sdcDownloadHref("ita2569-o22-01"),
      },
      {
        title: "รายงานผลด้านการบริหารงานบุคคล",
        href: sdcDownloadHref("ita2569-o22-02"),
      },
      {
        title: "รายงานผลตามแผนบริหารความเสี่ยงการทุจริต ประจำปีงบประมาณ พ.ศ. 2568",
        href: sdcDownloadHref("ita2569-o22-03"),
      },
    ],
  },
  {
    marker: "O24",
    links: [
      {
        title: "024รายงานผลการดำเนินการป้องกันการทุจริต ปีงบประมาณ 2568",
        href: sdcDownloadHref("ita2569-o24-01"),
      },
    ],
  },
  {
    marker: "O25",
    links: [
      {
        title: "นำผลการประเมิน ITA ไปสู่การพัฒนาองค์กร",
        href: `${ITA_O25_UPLOAD_DIR}/นำผลการประเมิน ITA ไปสู่การพัมนาองค์กร..pdf`,
      },
    ],
  },
  {
    marker: "O26",
    links: [
      {
        title: "รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรม",
        href: `${ITA_O26_UPLOAD_DIR}/รายงานผลการดำเนินการเพื่อส่งเสริมคุณธรรม.pdf`,
      },
    ],
  },
];

const ITA_2024_ANCHOR = "การประเมิน ITA ปี 2569";

function sdcDownloadHref(id: string): string {
  return `/sdc_download/${id}`;
}

function sdcDownloadInlineHref(id: string): string {
  return `${sdcDownloadHref(id)}?inline=1`;
}

function itaO12Href(fileName: string): string {
  return `${ITA_O12_UPLOAD_DIR}/${fileName.replaceAll(" ", "_")}`;
}

function shouldOverride(record: WpContentRecord): boolean {
  return record.id === THAI_ITA_PAGE_ID;
}

function findIt2024Section($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const sections = $("div.lightweight-accordion-body").toArray();
  for (const element of sections) {
    const $node = $(element);
    if ($node.text().includes(ITA_2024_ANCHOR)) {
      return $node;
    }
  }
  return null;
}

function applyReplacementsToSubtree(
  $: cheerio.CheerioAPI,
  subtree: cheerio.Cheerio<AnyNode>,
  expectedHeadingMarkers: Set<string>,
): { didChange: boolean } {
  let didChange = false;
  for (const [needle, replacement] of ITA_HEADING_REPLACEMENTS) {
    const sectionText = subtree.text();
    if (sectionText.includes(replacement)) {
      continue;
    }
    if (!sectionText.includes(needle)) {
      const firstWord = needle.split(" ")[0];
      if (firstWord && expectedHeadingMarkers.has(firstWord)) {
        console.warn(
          `[ita-headings-override] expected heading not found in 2569 section: "${needle.slice(0, 80)}…"`,
        );
      }
      continue;
    }
    let nodeChanged = false;
    subtree.find("p, h1, h2, h3, h4, h5, h6, strong, a, li, span").each((_, element) => {
      const $el = $(element);
      const html = $el.html();
      if (!html || !html.includes(needle)) {
        return;
      }
      const replaced = html.split(needle).join(replacement);
      if (replaced !== html) {
        $el.html(replaced);
        nodeChanged = true;
      }
    });
    if (nodeChanged) {
      didChange = true;
    }
  }
  return { didChange };
}

function isItaHeadingParagraph($: cheerio.CheerioAPI, element: AnyNode): boolean {
  return /^O\d+\b/.test($(element).text().trim());
}

function linkParagraph(
  $: cheerio.CheerioAPI,
  title: string,
  href: string,
  options: { indent?: boolean } = {},
): string {
  const paragraph = $("<p></p>");
  if (options.indent) {
    paragraph.attr("style", "margin-left: 1.5rem; padding-left: 1rem;");
  }
  const link = $("<a></a>");
  link.attr("href", href);
  link.text(`– ${title}`);
  paragraph.append(link);
  return $.html(paragraph);
}

function applyLinkOverridesToSubtree(
  $: cheerio.CheerioAPI,
  subtree: cheerio.Cheerio<AnyNode>,
): { didChange: boolean } {
  let didChange = false;

  for (const override of ITA_LINK_OVERRIDES) {
    const heading = subtree
      .find("p")
      .toArray()
      .find((element) => $(element).text().trim().startsWith(`${override.marker} `));

    if (!heading) {
      console.warn(
        `[ita-headings-override] expected link section not found in 2569 section: ${override.marker}`,
      );
      continue;
    }

    const $heading = $(heading);
    const headingText = $heading.text().trim();

    const existingLinks: Array<{ title: string; href: string | undefined }> = [];
    let scan = $heading.next();
    while (scan.length) {
      if (scan[0] && scan.is("p") && isItaHeadingParagraph($, scan[0])) {
        break;
      }
      if (scan.is("h1, h2, h3, h4, h5, h6")) {
        break;
      }
      if (scan.is("p")) {
        const link = scan.find("a").first();
        existingLinks.push({ title: link.text().trim(), href: link.attr("href") });
      }
      scan = scan.next();
    }

    const expectedLinks = override.links.map((link) => ({
      title: `– ${link.title}`,
      href: link.href,
    }));
    const linksAlreadyMatch =
      existingLinks.length === expectedLinks.length &&
      existingLinks.every(
        (link, index) =>
          link.title === expectedLinks[index]?.title &&
          link.href === expectedLinks[index]?.href,
      );
    if (linksAlreadyMatch && $heading.text().trim() === headingText) {
      continue;
    }

    $heading.empty().append($("<strong></strong>").text(headingText));

    let next = $heading.next();
    while (next.length) {
      if (next[0] && next.is("p") && isItaHeadingParagraph($, next[0])) {
        break;
      }
      if (next.is("h1, h2, h3, h4, h5, h6")) {
        break;
      }

      const current = next;
      next = next.next();
      current.remove();
    }

    $heading.after(
      override.links
        .map((link) => linkParagraph($, link.title, link.href, { indent: link.indent }))
        .join("\n"),
    );
    didChange = true;
  }

  return { didChange };
}

export function applyItaHeadingsOverride(record: WpContentRecord): WpContentRecord {
  if (!shouldOverride(record)) {
    return record;
  }

  const $ = cheerio.load(record.contentHtml, null, false);
  const subtree = findIt2024Section($);
  if (!subtree) {
    console.warn(
      `[ita-headings-override] could not locate 2024 (ITA ปี 2569) section in ${record.id}; skipping all replacements.`,
    );
    return record;
  }

  const expectedHeadingMarkers = new Set(
    ITA_HEADING_REPLACEMENTS.map(([needle]) => needle.split(" ")[0]).filter(
      (marker): marker is string => Boolean(marker),
    ),
  );

  const replacementResult = applyReplacementsToSubtree(
    $,
    subtree,
    expectedHeadingMarkers,
  );
  const linkResult = applyLinkOverridesToSubtree($, subtree);
  if (!replacementResult.didChange && !linkResult.didChange) {
    return record;
  }

  return { ...record, contentHtml: $.html() };
}
