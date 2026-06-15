import type {
  WpDownloadAsset,
  WpNavigationItem,
} from "@/lib/wp/types";
import type { ContentView } from "@/lib/content/types";

export const MOCK_RECORDS: ContentView[] = [
  {
    id: "1",
    language: "th",
    kind: "page",
    path: "/",
    title: "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
    excerpt: "หน่วยงานวิจัยและพัฒนาเทคโนโลยีระบบราง เพื่อยกระดับระบบรางไทยอย่างยั่งยืน",
    body: "ยินดีต้อนรับสู่เว็บไซต์ สทร. (ข้อมูลตัวอย่างสำหรับการพัฒนา)",
    date: "2025-01-01T00:00:00",
    parentPath: null,
    featuredImagePath: "/stitch-assets/home-hero.png",
    sourceUrl: "",
  },
  {
    id: "2",
    language: "en",
    kind: "page",
    path: "/en",
    title: "Rail Technology Research and Development Agency",
    excerpt: "Research and development for Thailand rail technology and sustainable rail systems.",
    body: "Welcome to RTRDA (mock data for development).",
    date: "2025-01-01T00:00:00",
    parentPath: null,
    featuredImagePath: "/stitch-assets/home-hero.png",
    sourceUrl: "",
  },
  {
    id: "3",
    language: "th",
    kind: "page",
    path: "/เกี่ยวกับ-สทร",
    title: "เกี่ยวกับ สทร.",
    excerpt: "ประวัติและพันธกิจของสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง",
    body: "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (สทร.) จัดตั้งขึ้นตามพระราชกฤษฎีกา",
    date: "2025-01-01T00:00:00",
    parentPath: null,
    featuredImagePath: "/stitch-assets/rail-lab.png",
    sourceUrl: "",
  },
  {
    id: "4",
    language: "th",
    kind: "post",
    path: "/ข่าวสาร-กิจกรรม/ข่าวตัวอย่าง",
    title: "ข่าวตัวอย่างสำหรับการพัฒนา",
    excerpt: "นี่คือตัวอย่างข่าวสารที่ใช้ในการพัฒนาระบบ",
    body: "เนื้อหาข่าวตัวอย่าง สำหรับทดสอบการแสดงผล",
    date: "2025-06-01T00:00:00",
    parentPath: "/ข่าวสาร-กิจกรรม",
    featuredImagePath: "/stitch-assets/rail-network.png",
    sourceUrl: "",
  },
  {
    id: "5",
    language: "th",
    kind: "post",
    path: "/ข่าวสาร-กิจกรรม/ข่าวตัวอย่าง-2",
    title: "ข่าวล่าสุด: ความก้าวหน้าระบบราง",
    excerpt: "อัพเดทความก้าวหน้าการพัฒนาระบบรางของประเทศไทย",
    body: "เนื้อหาข่าวล่าสุด",
    date: "2025-06-10T00:00:00",
    parentPath: "/ข่าวสาร-กิจกรรม",
    featuredImagePath: "/stitch-assets/rail-strategy-map.png",
    sourceUrl: "",
  },
];

export const MOCK_NAV: WpNavigationItem[] = [
  { label: "หน้าแรก", href: "/", path: "/", external: false, children: [] },
  { label: "เกี่ยวกับ สทร.", href: "/เกี่ยวกับ-สทร", path: "/เกี่ยวกับ-สทร", external: false, children: [] },
  { label: "ข่าวสาร/กิจกรรม", href: "/ข่าวสาร-กิจกรรม", path: "/ข่าวสาร-กิจกรรม", external: false, children: [] },
  { label: "ติดต่อเรา", href: "/ติดต่อเรา", path: "/ติดต่อเรา", external: false, children: [] },
];

export const MOCK_NAV_EN: WpNavigationItem[] = [
  { label: "Home", href: "/en", path: "/en", external: false, children: [] },
  { label: "About RTRDA", href: "/en/เกี่ยวกับ-สทร", path: "/en/เกี่ยวกับ-สทร", external: false, children: [] },
  { label: "Contact Us", href: "/en/ติดต่อเรา", path: "/en/ติดต่อเรา", external: false, children: [] },
];

export const MOCK_DOWNLOADS: WpDownloadAsset[] = [
  {
    id: "mock-download-1",
    sourceUrl: "",
    localPath: "/sdc-downloads/sample.pdf",
    fileName: "sample.pdf",
    mimeType: "application/pdf",
    sizeBytes: 102400,
    title: "เอกสารตัวอย่าง",
    group: "general",
    sourcePages: [],
  },
];
