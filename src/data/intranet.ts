export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; href: string; children: NavItem[] };
export type IconItem = { img: string; href: string; caption: string };

export const NAV: NavGroup[] = [
  {
    label: "CALENDAR SYSTEM",
    href: "#",
    children: [
      {
        label: "RTRDA",
        href: "https://calendar.google.com/calendar/u/0/embed?src=f8a4bd7f391b6d69a4d01cf5c5a6530213db6764b4f173c0a26bd5d0be392b9a@group.calendar.google.com&ctz=Indian/Christmas",
      },
      { label: "PRESIDENT", href: "#" },
      { label: "DIRECTOR D1", href: "#" },
    ],
  },
  {
    label: "MEETING ROOM",
    href: "#",
    children: [
      {
        label: "SCHEDULE",
        href: "https://calendar.google.com/calendar/embed?src=58b0c49965dd3d9b9dc2575a3322a2fd69db744c1c360dcfc3d6612e91f99d9e%40group.calendar.google.com&ctz=Asia%2FBangkok",
      },
      {
        label: "RESERVE",
        href: "https://docs.google.com/forms/d/e/1FAIpQLScmEztgRzR7ar4-xyI1o8ldU3xIHrYwOA1MX5ljOOhoQhU4LA/viewform",
      },
    ],
  },
  {
    label: "CAR RESERVATION",
    href: "#",
    children: [
      {
        label: "SCHEDULE CAR",
        href: "https://calendar.google.com/calendar/embed?src=fc4f79fbf07e2c8777ec1358404907ddee89366e5bdc4a1fed65c348fcd7f326%40group.calendar.google.com&ctz=Asia%2FBangkok",
      },
      {
        label: "SCHEDULE VAN",
        href: "https://calendar.google.com/calendar/embed?src=fdae8485008aad70fc1d1bd0ee210e818b4be9d7582d3405e1c0cd49bb646eb5%40group.calendar.google.com&ctz=Asia%2FBangkok",
      },
      { label: "Booking", href: "https://forms.gle/ecpXE3mdbFkq9n6R6" },
    ],
  },
  {
    label: "STAFF",
    href: "#",
    children: [
      {
        label: "RTRDA STAFF",
        href: "https://docs.google.com/spreadsheets/d/1fehN8NjuUhXvDxRDJfhI2NbOuUfEA1nLkdvzw08tVyc/edit?usp=sharing",
      },
    ],
  },
  {
    label: "CLOUD DRIVE",
    href: "#",
    children: [
      {
        label: "ONE DRIVE (ส่วนตัว)",
        href: "https://onedrive.live.com/about/th-th/signin/",
      },
      {
        label: "Cloud SHARE (ส่วนกลาง)",
        href: "https://rtrda.cloudhm.io/",
      },
      {
        label: "คู่มือการใช้งาน และตัวติดตั้ง Cloud Share (ส่วนกลาง)",
        href: "https://rtrda.cloudhm.io/index.php/s/jtstEtq547bGpzA",
      },
    ],
  },
];

export const ICON_ROWS: IconItem[][] = [
  // Section 1 — quick-access (no captions)
  [
    {
      img: "/intranet/icons/Icon-Intranet-04.png",
      href: "https://calendar.google.com/calendar/u/0/embed?src=e4ad80ff82a957047892b2298c2e8af11074d7cbc908b4424d40c204543a958e@group.calendar.google.com&ctz=Asia/Bangkok",
      caption: "",
    },
    {
      img: "/intranet/icons/Icon-Intranet-05.png",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSc0IDiYIS0blmY5G8yksUrmXOSVUNcbWkn3ZtGbo1k84jNiCw/viewform",
      caption: "",
    },
    {
      img: "/intranet/icons/Icon-Intranet-06.png",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSeJS1fSlq9YcaTDkdBJRBMLpy4p1XuJ7_5ABGGxzae8nNu08Q/viewform?usp=send_form",
      caption: "",
    },
  ],
  // Section 2
  [
    {
      img: "/intranet/icons/8106c7b7-e385-49aa-b60f-3743521e7181.png",
      href: "https://erp.rtrda.or.th/login",
      caption: "ระบบบริหารงานทรัพยากรองค์กรภาครัฐ (ERP)",
    },
    {
      img: "/intranet/icons/e9168a2a-db42-402a-bb81-25d0b7478344.png",
      href: "https://ehandbook.rtrda.or.th/",
      caption: "ระบบเทคโนโลยีสารสนเทศเพื่อการติดตามและรายงานผลปฏิบัติงาน (e-Handbook)",
    },
    {
      img: "/intranet/icons/da1d4001-df8b-49e0-bb83-c5a01adc5003.png",
      href: "https://rtrda.athm-hr.com/#/account/login",
      caption: "ระบบบริหารงานบุคคล (ATHM)",
    },
  ],
  // Section 3
  [
    {
      img: "/intranet/icons/e-saraban-1.png",
      href: "https://rtrda.e-office.cloud/portal/home",
      caption: "ระบบสารบรรณอิเล็กทรอนิกส์ (e-Saraban)",
    },
    {
      img: "/intranet/icons/Microsoft_Outlook-Logo.wine_-scaled.png",
      href: "https://outlook.office.com/mail/",
      caption: "ระบบจดหมายอิเล็กทรอนิกส์ (e-mail)",
    },
    {
      img: "/intranet/icons/images.png",
      href: "https://chatgpt.com/",
      caption: "ChatGPT",
    },
  ],
  // Section 4
  [
    {
      img: "/intranet/icons/nfrail_rtrda_logo_1536_optimized.png",
      href: "https://nrail.rtrda.or.th/",
      caption: "ฐานข้อมูลด้านเทคโนโลยีระบบรางของประเทศ (NRAIL)",
    },
    {
      img: "/intranet/icons/ChatGPT-Image-Mar-10-2026-12_48_56-PM.png",
      href: "https://rtrda.cloudhm.io/index.php/f/1003378",
      caption: "Executive Report",
    },
  ],
];
