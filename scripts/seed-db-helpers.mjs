const ITA_2569_SUPPLEMENTAL_DOWNLOADS = [
  {
    id: "ita2569-o19-01",
    fileName: "แบบฟอร์มการมีส่วนร่วมo19_v3.pdf",
    sizeBytes: 903600,
    title: "แบบฟอร์มการมีส่วนร่วมo19_v3",
  },
  {
    id: "ita2569-o19-02",
    fileName: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568.pdf",
    sizeBytes: 2609099,
    title: "เอกสารประกอบที่ 1 คำสั่งสทรที่52-2568",
  },
  {
    id: "ita2569-o19-03",
    fileName: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568.pdf",
    sizeBytes: 1004907,
    title: "เอกสารประกอบที่ 2 รายงานประชุม ครั้งที่ 4-2568",
  },
  {
    id: "ita2569-o19-04",
    fileName: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing.pdf",
    sizeBytes: 2214606,
    title: "เอกสารประกอบที่ 3 สรุปการประชุมTechnical Hearing",
  },
  {
    id: "ita2569-o19-05",
    fileName: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568.pdf",
    sizeBytes: 1940053,
    title: "เอกสารประกอบที่ 4 รายงานประชุม ครั้งที่ 10-2568",
  },
  {
    id: "ita2569-o19-06",
    fileName: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568.pdf",
    sizeBytes: 1350481,
    title: "เอกสารประกอบที่ 5 รายงานการประชุม ครั้งที่ 26(4)-2568",
  },
  {
    id: "ita2569-o19-07",
    fileName: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์.pdf",
    sizeBytes: 435085,
    title: "เอกสารประกอบที่ 6 รายงานการจัดทำประชาพิจารณ์",
  },
  {
    id: "ita2569-o21-01",
    fileName: "การประเมินความเสี่ยงทุจริต_5_ขั้นตอน.pdf",
    sizeBytes: 4773342,
    title: "การประเมินความเสี่ยงทุจริต_5_ขั้นตอน",
    group: "O21",
  },
  {
    id: "ita2569-o22-01",
    fileName: "รายงานผลการดำเนินงานตามแผนบริหารจัดการค.pdf",
    sizeBytes: 642714,
    title: "รายงานผลการดำเนินงานตามแผนบริหารจัดการค",
    group: "O22",
  },
].map((download) => ({
  ...download,
  sourceUrl: `https://www.rtrda.or.th/sdc_download/${download.id}/`,
  localPath: `/sdc-downloads/${download.id}.pdf`,
  mimeType: "application/pdf",
  group: download.group ?? "O19",
  sourcePages: ["/การประเมินคุณธรรมและคว"],
}));

const NO_GIFT_POLICY_NEWS = {
  id: "th-post-8063",
  wpId: "8063",
  language: "th",
  kind: "post",
  path: "/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569",
  sourceUrl: "https://www.rtrda.or.th/สทร-ร่วมประกาศเจตนารมณ์-no-gift-policy-2569/",
  title:
    "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ร่วมประกาศเจตนารมณ์การต่อต้านการทุจริตคอร์รัปชันในองค์กร การไม่รับของขวัญ (No Gift Policy) และขับเคลื่อน สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) สู่องค์กรคุณธรรมต้นแบบ สร้างจิตสํานึกองค์กร ยึดตามหลักธรรมทางศาสนา หลักปรัชญาของเศรษฐกิจพอเพียง วิถีวัฒนธรรม และคุณธรรม ๕ ประการ (พอเพียง วินัย สุจริต จิตอาสา กตัญญู ) ประจำปีงบประมาณ พ.ศ. ๒๕๖๙",
  excerpt:
    "เมื่อวันที่ ๒๔ กุมภาพันธ์ ๒๕๖๙ นางสาวเพียงออ เลาหะวิไลย ผู้อำนวยการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง พร้อมด้วยผู้บริหารและเจ้าหน้าที่ ได้ร่วมกันประกาศเจตนารมณ์การต่อต้านการทุจริตคอร์รัปชันในองค์กร การไม่รับของขวัญ (No Gift Policy)… อ่านเพิ่มเติม",
  date: "2026-02-24T00:00:00",
  modified: "2026-06-25T00:00:00",
  parentPath: null,
  categoryIds: [7],
  featuredMediaId: 8063,
  authorId: null,
};

const NO_GIFT_POLICY_PARAGRAPHS = [
  "เมื่อวันที่ ๒๔ กุมภาพันธ์ ๒๕๖๙ นางสาวเพียงออ เลาหะวิไลย ผู้อำนวยการสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง พร้อมด้วยผู้บริหารและเจ้าหน้าที่ ได้ร่วมกันประกาศเจตนารมณ์การต่อต้านการทุจริตคอร์รัปชันในองค์กร การไม่รับของขวัญ (No Gift Policy) และขับเคลื่อนสถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) สู่องค์กรคุณธรรมต้นแบบ สร้างจิตสำนึก ยึดตามหลักธรรมทางศาสนา หลักปรัชญาเศรษฐกิจพอเพียง วิถีวัฒนธรรมไทย และคุณธรรม ๕ ประการ (พอเพียง วินัย สุจริต จิตอาสา กตัญญู) ประจำปีงบประมาณ พ.ศ. ๒๕๖๙ ณ ชั้น ๑๐ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) เพื่อสนับสนุนให้บุคลากรภายในองค์กร มีวัฒนธรรมและพฤติกรรมที่ซื่อสัตย์สุจริต ปฏิเสธการรับของขวัญและของกำนัลทุกชนิดใน ขณะ ก่อน หรือหลังการปฏิบัติหน้าที่ สร้างความโปร่งใส เป็นธรรม ไม่เลือกปฏิบัติ รวมทั้งขับเคลื่อนและสร้างความตระหนักในเรื่องการทุจริตภายในองค์กร",
  "นอกจากนี้ ผู้บริหารและเจ้าหน้าที่ได้ร่วมกันลงลายมือชื่อเพื่อร่วมกันประกาศเจตนารมณ์อย่างเป็นลายลักษณ์อักษรและมีการถ่ายภาพร่วมกันเพื่อแสดงพลังและความมุ่งมั่นในการต่อต้านการทุจริตคอร์รัปชันในองค์กร",
];

const NO_GIFT_POLICY_MEDIA = Array.from({ length: 10 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const fileName = `no-gift-policy-240269-${number}.jpg`;
  return {
    id: String(8063 + index),
    sourceUrl: `https://www.rtrda.or.th/wp-content/uploads/2026/02/${fileName}`,
    localPath: `/wp-content/uploads/2026/02/${fileName}`,
    title: `no-gift-policy-240269-${number}`,
    alt: "",
    width: 2048,
    height: 1365,
    mimeType: "image/jpeg",
  };
});

const FACEBOOK_RESTORED_NEWS = [
  {
    id: "91001",
    wpId: "91001",
    path: "/สทร-ร่วมหารือ-siamese-train-ยกระดับท่องเที่ยวทางรางไทย",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid031DhHn3zFfWpksYHQ2ragEyBkakDkb8riiqU29zAa9KMcCeSyhS65rBaCV852cLHGl?rdid=zfYahPqStSZc2DrT&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F1C55j6ZHuf%2F",
    shareUrl: "https://www.facebook.com/share/p/1C55j6ZHuf/",
    title:
      "สทร. ร่วมหารือแนวทางพัฒนารถไฟท่องเที่ยว Siamese Train เพื่อยกระดับการท่องเที่ยวทางรางไทย",
    excerpt:
      "สทร. ร่วมหารือแนวทางพัฒนารถไฟท่องเที่ยว Siamese Train เพื่อยกระดับการท่องเที่ยวทางรางไทย วันที่ 24 มิถุนายน 2569 สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) หรือ สทร....",
    date: "2026-06-24T09:00:00",
    paragraphs: [
      "สทร. ร่วมหารือแนวทางพัฒนารถไฟท่องเที่ยว Siamese Train เพื่อยกระดับการท่องเที่ยวทางรางไทย",
      "วันที่ 24 มิถุนายน 2569 สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) หรือ สทร....",
    ],
    media: {
      id: "91101",
      sourceUrl:
        "https://scontent.fbkk8-2.fna.fbcdn.net/v/t39.30808-6/730321413_1012828261506340_2787768727552444636_n.jpg?stp=dst-jpg_tt6&cstp=mx1567x1045&ctp=p600x600&_nc_cat=110&ccb=1-7&_nc_sid=cae128&_nc_ohc=RIgXv99DjiwQ7kNvwGESGfj&_nc_oc=Adq7S_XvXri_dNJMmvOmap0nECqG945ULajysAMqFooxltTxhGUZhwWZw7j6y9pt8pr1sccm9Ps4UaH20OtXYypW&_nc_zt=23&_nc_ht=scontent.fbkk8-2.fna&_nc_gid=IUEaFBX17zf07Ic3C7dihA&_nc_ss=7920f&oh=00_Af9VuPywd1K2p-bLo8Lh-gv_5IZeYS4BQecXlHIBExcwnQ&oe=6A4862D4",
      localPath:
        "/wp-content/uploads/news-2569/fb-siamese-train-240669/fb-siamese-train-240669-01.jpg",
      title: "fb-siamese-train-240669",
      alt: "สทร. ร่วมหารือแนวทางพัฒนารถไฟท่องเที่ยว Siamese Train เพื่อยกระดับการท่องเที่ยวทางรางไทย",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91002",
    wpId: "91002",
    path: "/สทร-จัดอบรมงานพัสดุ-จัดซื้อจัดจ้าง-ภาครัฐ",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid0TiikJqvgQJSZHXL4aPBehSvoi7UodpgPvWYDSNokbWofEf9bw3csDG6zck8yHCtAl?rdid=hKwJXNJI59wFpBSU&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F195T6wsJtQ%2F",
    shareUrl: "https://www.facebook.com/share/p/195T6wsJtQ/",
    title:
      "สทร. จัดอบรมเชิงปฏิบัติการ เสริมประสิทธิภาพงานพัสดุ จัดซื้อจัดจ้าง และบริหารพัสดุภาครัฐ",
    excerpt:
      "สทร. จัดอบรมเชิงปฏิบัติการ เสริมประสิทธิภาพงานพัสดุ จัดซื้อจัดจ้าง และบริหารพัสดุภาครัฐ วันที่ 23 มิถุนายน 2569 สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) หรือ สทร....",
    date: "2026-06-23T13:00:00",
    paragraphs: [
      "สทร. จัดอบรมเชิงปฏิบัติการ เสริมประสิทธิภาพงานพัสดุ จัดซื้อจัดจ้าง และบริหารพัสดุภาครัฐ",
      "วันที่ 23 มิถุนายน 2569 สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) หรือ สทร....",
    ],
    media: {
      id: "91102",
      sourceUrl:
        "https://scontent.fbkk13-1.fna.fbcdn.net/v/t39.30808-6/730313794_1011953721593794_7647380600936988974_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x1365&ctp=p600x600&_nc_cat=105&ccb=1-7&_nc_sid=cae128&_nc_ohc=O0BGkfAQ1awQ7kNvwFe87Ln&_nc_oc=AdrYS46bYv5B5um3fpeylInWXg5WWRoBwLvNXJ7ISkToh-VvwzP2Nc2XCBRcG1msMJtYCPh0i2Zcvn3HDg90Fzhw&_nc_zt=23&_nc_ht=scontent.fbkk13-1.fna&_nc_gid=RWQdZiNAnqGCR4iMS86Ijg&_nc_ss=7920f&oh=00_Af_e138T4m67NRC35Qh0WPqHD97qpSxUqGV9dNcLALjJ_g&oe=6A4887CE",
      localPath:
        "/wp-content/uploads/news-2569/fb-procurement-training-230669/fb-procurement-training-230669-01.jpg",
      title: "fb-procurement-training-230669",
      alt: "สทร. จัดอบรมเชิงปฏิบัติการ เสริมประสิทธิภาพงานพัสดุ จัดซื้อจัดจ้าง และบริหารพัสดุภาครัฐ",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91003",
    wpId: "91003",
    path: "/การประเมินองค์กรคุณธรรม-ประจำปี-2569",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid02QGD6aHhCeQRFWcXpsU8aP6qnJYjbUC4DhPAbgAHj1QBLLEKZCs1UVDjkd6TCHYBsl?rdid=fkFdeFXWNlVlaPCE&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F17hEeKj4qJ%2F",
    shareUrl: "https://www.facebook.com/share/p/17hEeKj4qJ/",
    title:
      "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ขอเผยแพร่ข้อมูล การประเมินองค์กรคุณธรรม ประจำปี พ.ศ. 2569",
    excerpt:
      "📣 สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ขอเผยแพร่ข้อมูล การประเมินองค์กรคุณธรรม ประจำปี พ.ศ. 2569 📎 รายละเอียดตามเอกสารแนบ :...",
    date: "2026-06-23T10:30:00",
    paragraphs: [
      "📣 สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ขอเผยแพร่ข้อมูล การประเมินองค์กรคุณธรรม ประจำปี พ.ศ. 2569",
      "📎 รายละเอียดตามเอกสารแนบ :...",
    ],
    media: {
      id: "91103",
      sourceUrl:
        "https://scontent.fbkk12-3.fna.fbcdn.net/v/t39.30808-6/729964555_1011910671598099_6686519633501929304_n.jpg?stp=dst-jpg_tt6&cstp=mx1567x1045&ctp=p600x600&_nc_cat=102&ccb=1-7&_nc_sid=cae128&_nc_ohc=AP47DaCtqpAQ7kNvwG22Psc&_nc_oc=AdrvjPpYTtdJJ2UX6Pg9HSvIy8byqbwPjsVihkx0vNLcx2Ge__UAC1U4aLg98c8-WFwYh0XwvZemeZ1tgUjWh3Cn&_nc_zt=23&_nc_ht=scontent.fbkk12-3.fna&_nc_gid=eyauR68cWXZc5c9JWLeVQg&_nc_ss=7920f&oh=00_Af9NjP65nXZazx52EP70muEQN7oq36gX4fsMp3tXLuq55w&oe=6A488314",
      localPath:
        "/wp-content/uploads/news-2569/fb-moral-organization-2569/fb-moral-organization-2569-01.jpg",
      title: "fb-moral-organization-2569",
      alt: "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) ขอเผยแพร่ข้อมูล การประเมินองค์กรคุณธรรม ประจำปี พ.ศ. 2569",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91004",
    wpId: "91004",
    path: "/สำนักงาน-ปปช-ลงพื้นที่จัดเก็บข้อมูล-iit-2569",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid02YqfKFSWdNEDaZWFPoohexoiBr4NGwhLyDwtt8uReWqo4bFrXf7Zkm4SSC1vPS44tl?rdid=4uFt4msyW7SYCabI&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F1Bf22uaXQg%2F",
    shareUrl: "https://www.facebook.com/share/p/1Bf22uaXQg/",
    title:
      "สำนักงาน ป.ป.ช. ลงพื้นที่จัดเก็บข้อมูล IIT ประจำปีงบประมาณ 2569 มุ่งสะท้อนธรรมาภิบาลและความโปร่งใสภายในสถาบันฯ",
    excerpt:
      "สำนักงาน ป.ป.ช. ลงพื้นที่จัดเก็บข้อมูล IIT ประจำปีงบประมาณ 2569 มุ่งสะท้อนธรรมาภิบาลและความโปร่งใสภายในสถาบันฯ วันที่ 22 มิถุนายน 2569  สำนักงานคณะกรรมการป้องกันและปราบปรามการทุจริตแห่งชาติ...",
    date: "2026-06-22T10:00:00",
    paragraphs: [
      "สำนักงาน ป.ป.ช. ลงพื้นที่จัดเก็บข้อมูล IIT ประจำปีงบประมาณ 2569 มุ่งสะท้อนธรรมาภิบาลและความโปร่งใสภายในสถาบันฯ",
      "วันที่ 22 มิถุนายน 2569  สำนักงานคณะกรรมการป้องกันและปราบปรามการทุจริตแห่งชาติ...",
    ],
    media: {
      id: "91104",
      sourceUrl:
        "https://scontent.fbkk13-3.fna.fbcdn.net/v/t39.30808-6/731014750_1011764054946094_5373455084666875390_n.jpg?stp=cp6_dst-jpegr_tt6&cstp=mx1477x1108&ctp=p600x600&_nc_cat=108&ccb=1-7&_nc_sid=cae128&_nc_ohc=u3bqsShbCDQQ7kNvwHd8910&_nc_oc=AdrQXjqAq1wSSMs5u_iX7P58LXFBuhirJNmKRU3Bh-ymAC1d_AAHgarqY7C16zxpe26WMcKdTbOYazrF6K5gS07h&_nc_zt=23&se=-1&_nc_ht=scontent.fbkk13-3.fna&_nc_gid=6rA18Zakg8XeyewiNaiCOA&_nc_ss=7920f&oh=00_Af8gIDZbb9DKr0PDTpxs-kvJlYRaHddLFln20v90Yt3KEg&oe=6A486C13",
      localPath:
        "/wp-content/uploads/news-2569/fb-nacc-iit-220669/fb-nacc-iit-220669-01.jpg",
      title: "fb-nacc-iit-220669",
      alt: "สำนักงาน ป.ป.ช. ลงพื้นที่จัดเก็บข้อมูล IIT ประจำปีงบประมาณ 2569 มุ่งสะท้อนธรรมาภิบาลและความโปร่งใสภายในสถาบันฯ",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91005",
    wpId: "91005",
    path: "/สทร-ลงพื้นที่ศึกษารถดีเซลราง-thn",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid02pBixYREwRM6oprse4YFUWptSRSZai4EjpHSqJikZe7KPkw1zaJgUbjN9a3LJWDQQl?rdid=re1ZlFlnxzTYxCId&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F1L3i3S2Ce3%2F",
    shareUrl: "https://www.facebook.com/share/p/1L3i3S2Ce3/",
    title: "สทร. ลงพื้นที่ศึกษารถดีเซลราง THN ต่อยอดงานวิจัยรถไฟโดยสารพลังงานแบตเตอรี่",
    excerpt:
      "สทร. ลงพื้นที่ศึกษารถดีเซลราง THN ต่อยอดงานวิจัยรถไฟโดยสารพลังงานแบตเตอรี่ สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) หรือ สทร....",
    date: "2026-06-20T09:00:00",
    paragraphs: [
      "สทร. ลงพื้นที่ศึกษารถดีเซลราง THN",
      "ต่อยอดงานวิจัยรถไฟโดยสารพลังงานแบตเตอรี่",
      "สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน) หรือ สทร....",
    ],
    media: {
      id: "91105",
      sourceUrl:
        "https://scontent.fbkk8-4.fna.fbcdn.net/v/t39.30808-6/729468121_1011083318347501_8167461787325154902_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x1365&ctp=p600x600&_nc_cat=100&ccb=1-7&_nc_sid=cae128&_nc_ohc=QbPXngOMnugQ7kNvwHBLR52&_nc_oc=AdqltE4SrbWksrX2ev4CxOs-RQad1FSD_qdwbHzyYsPqFapGiCfRfji-vjIYocOGBM2xKe6ardQ7Jz2KvGdpexCe&_nc_zt=23&_nc_ht=scontent.fbkk8-4.fna&_nc_gid=Ddt8YWvHINRGtb2tDihwog&_nc_ss=7920f&oh=00_Af8xPJMGIRIBkubNLcNayuAFvZdrDHiX8K8x0NlVizqOQA&oe=6A48802E",
      localPath:
        "/wp-content/uploads/news-2569/fb-thn-diesel-railcar-study/fb-thn-diesel-railcar-study-01.jpg",
      title: "fb-thn-diesel-railcar-study",
      alt: "สทร. ลงพื้นที่ศึกษารถดีเซลราง THN ต่อยอดงานวิจัยรถไฟโดยสารพลังงานแบตเตอรี่",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91006",
    wpId: "91006",
    path: "/สทร-สยย-ผนึกกำลัง-incubation-team",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid0RETGBtHJBnGoRm7k7fSy3Wdyed9Si8Nty7pV1RSwEHavmaQS7v6heFzRBigWNU5rl?rdid=4jnt1cCfUqiJNosq&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F194DbBYp6k%2F",
    shareUrl: "https://www.facebook.com/share/p/194DbBYp6k/",
    title:
      "สทร. – สยย. ผนึกกำลังสร้าง “Incubation Team” ยกระดับผู้ประกอบการไทยสู่ห่วงโซ่อุปทานการผลิตรถไฟ",
    excerpt:
      "สทร. – สยย. ผนึกกำลังสร้าง “Incubation Team” ยกระดับผู้ประกอบการไทยสู่ห่วงโซ่อุปทานการผลิตรถไฟ ภายใต้วิสัยทัศน์การสร้างอุตสาหกรรมรถไฟในประเทศ ย้ำความร่วมมือระหว่างคมนาคมและอุตสาหกรรม 19 มิถุนายน...",
    date: "2026-06-19T09:00:00",
    paragraphs: [
      "สทร. – สยย. ผนึกกำลังสร้าง “Incubation Team” ยกระดับผู้ประกอบการไทยสู่ห่วงโซ่อุปทานการผลิตรถไฟ ภายใต้วิสัยทัศน์การสร้างอุตสาหกรรมรถไฟในประเทศ ย้ำความร่วมมือระหว่างคมนาคมและอุตสาหกรรม",
      "19 มิถุนายน...",
    ],
    media: {
      id: "91106",
      sourceUrl:
        "https://scontent.fbkk12-5.fna.fbcdn.net/v/t39.30808-6/722640396_1007471822041984_2535687967153954937_n.jpg?stp=dst-jpg_tt6&cstp=mx1567x1045&ctp=p600x600&_nc_cat=107&ccb=1-7&_nc_sid=b96d88&_nc_ohc=WrvUSww13RcQ7kNvwG1xuPn&_nc_oc=AdosVPmXSy-YfpXIQwtZ8RFNbj0kDP_GE_dYBcHWPh3s5EHgt4OmG94mt2osckamdPwJAGOm_2i0vNTuogWn4nXR&_nc_zt=23&_nc_ht=scontent.fbkk12-5.fna&_nc_gid=MkBOYpcwMiadDwP1KyIO5w&_nc_ss=7920f&oh=00_Af_L3jfrW6Dpw7RZIuT-8b_yizc_G7BA52i1aoZIrGLLUQ&oe=6A4853F5",
      localPath:
        "/wp-content/uploads/news-2569/fb-incubation-team-190669/fb-incubation-team-190669-01.jpg",
      title: "fb-incubation-team-190669",
      alt: "สทร. – สยย. ผนึกกำลังสร้าง “Incubation Team” ยกระดับผู้ประกอบการไทยสู่ห่วงโซ่อุปทานการผลิตรถไฟ",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91007",
    wpId: "91007",
    path: "/สทร-จัดกิจกรรมจิตอาสา-เฉลิมพระเกียรติพระสังฆราช",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid02NcKhuagBNkycaTbfGuswZeqwjTHHA1Czr1DsYHHavpmdGQQvReTQX2wBVL8zsN8Sl?rdid=tPGkAc1zFY3caIf9&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F1D2xnw5wA8%2F",
    shareUrl: "https://www.facebook.com/share/p/1D2xnw5wA8/",
    title: "สทร. ร่วมใจจัดกิจกรรมจิตอาสาบำเพ็ญประโยชน์ เฉลิมพระเกียรติสมเด็จพระสังฆราช",
    excerpt:
      "สทร. ร่วมใจจัดกิจกรรมจิตอาสาบำเพ็ญประโยชน์ เฉลิมพระเกียรติสมเด็จพระสังฆราช เนื่องในโอกาสฉลองพระชนมายุ 99 พรรษา ณ วัดอุทัยธาราม (บางกะปิ) ในวันที่ 18 มิถุนายน 2569...",
    date: "2026-06-18T09:00:00",
    paragraphs: [
      "สทร. ร่วมใจจัดกิจกรรมจิตอาสาบำเพ็ญประโยชน์ เฉลิมพระเกียรติสมเด็จพระสังฆราช เนื่องในโอกาสฉลองพระชนมายุ 99 พรรษา ณ วัดอุทัยธาราม (บางกะปิ)",
      "ในวันที่ 18 มิถุนายน 2569...",
    ],
    media: {
      id: "91107",
      sourceUrl:
        "https://scontent.fbkk13-3.fna.fbcdn.net/v/t39.30808-6/727235435_1006717092117457_1296852890283432333_n.jpg?stp=dst-jpg_tt6&cstp=mx1567x1045&ctp=p600x600&_nc_cat=108&ccb=1-7&_nc_sid=b96d88&_nc_ohc=Jc9c_NXK-mIQ7kNvwGKMjyo&_nc_oc=AdrGA3QaexY75FGFO31eh5BNFEm04ZPv5A375UQLJiEXo9e6Ao3PSpSRheJ-zya7-7u3_Pd-92kQ1ZccIiaRc5Qi&_nc_zt=23&_nc_ht=scontent.fbkk13-3.fna&_nc_gid=hLDE_vkPprgHSfQB7S0Yjw&_nc_ss=7920f&oh=00_Af_pIjnEcRAhYlDiUsTi5rIGOJlwBkbJL9CzI62b7xVh2w&oe=6A485188",
      localPath:
        "/wp-content/uploads/news-2569/fb-volunteer-sangharaja-180669/fb-volunteer-sangharaja-180669-01.jpg",
      title: "fb-volunteer-sangharaja-180669",
      alt: "สทร. ร่วมใจจัดกิจกรรมจิตอาสาบำเพ็ญประโยชน์ เฉลิมพระเกียรติสมเด็จพระสังฆราช",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
  {
    id: "91008",
    wpId: "91008",
    path: "/สทร-เข้าร่วมพิธีปลงผม-บรรพชาอุปสมบท",
    sourceUrl:
      "https://www.facebook.com/rtrda.thailand/posts/pfbid02Fens1VHqDE13Mkn4JubLieSgrJEDHZbjJp8jp6hpMnRvUhQS1fKo7SVGMCrvexMtl?rdid=mV44ohrC46Py8KyS&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fp%2F1Bb6ySAz4m%2F",
    shareUrl: "https://www.facebook.com/share/p/1Bb6ySAz4m/",
    title:
      "สทร. เข้าร่วมพิธีปลงผมผู้ขอบรรพชาอุปสมบท ในโครงการบรรพชาอุปสมบทในพระสังฆราชูปถัมภ์",
    excerpt:
      "สทร. เข้าร่วมพิธีปลงผมผู้ขอบรรพชาอุปสมบท ในโครงการบรรพชาอุปสมบทในพระสังฆราชูปถัมภ์ ถวายพระกุศลแด่สมเด็จพระเจ้าลูกเธอ เจ้าฟ้าพัชรกิติยาภาฯ วันที่ 13 มิถุนายน 2569 เวลา 09.00 น. สมเด็จพระมหาวีรวงศ์...",
    date: "2026-06-13T09:00:00",
    paragraphs: [
      "สทร. เข้าร่วมพิธีปลงผมผู้ขอบรรพชาอุปสมบท ในโครงการบรรพชาอุปสมบทในพระสังฆราชูปถัมภ์ ถวายพระกุศลแด่สมเด็จพระเจ้าลูกเธอ เจ้าฟ้าพัชรกิติยาภาฯ",
      "วันที่ 13 มิถุนายน 2569 เวลา 09.00 น. สมเด็จพระมหาวีรวงศ์...",
    ],
    media: {
      id: "91108",
      sourceUrl:
        "https://scontent.fbkk12-1.fna.fbcdn.net/v/t39.30808-6/724033133_1003327269123106_123415553492509914_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x1365&ctp=p600x600&_nc_cat=101&ccb=1-7&_nc_sid=b96d88&_nc_ohc=sNHvJtTGvcIQ7kNvwEmNIFz&_nc_oc=AdqkBGXJan0ASWZ9uaXhnwDN4SxrrMxl88mSZO4RswkfxS8mqtx4D_5n-XAoDXK8Yc5j7__-K_yvDEZpzZ1G4jzx&_nc_zt=23&_nc_ht=scontent.fbkk12-1.fna&_nc_gid=n2pznL97G7RgGlz6sM_KFg&_nc_ss=7920f&oh=00_Af9n_0zdcM4AWdT3h5Pqpt9FckFuiXGi4cJM_brlHwfABQ&oe=6A4886AB",
      localPath:
        "/wp-content/uploads/news-2569/fb-ordination-130669/fb-ordination-130669-01.jpg",
      title: "fb-ordination-130669",
      alt: "สทร. เข้าร่วมพิธีปลงผมผู้ขอบรรพชาอุปสมบท ในโครงการบรรพชาอุปสมบทในพระสังฆราชูปถัมภ์",
      width: 1200,
      height: 800,
      mimeType: "image/jpeg",
    },
  },
];

function facebookRestoredNewsContentHtml(news) {
  const paragraphs = news.paragraphs
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n\n");
  return `${paragraphs}\n\n<p><a href="${news.sourceUrl}" target="_blank" rel="noopener noreferrer">ดูโพสต์ต้นทางบน Facebook</a></p>\n\n<figure class="wp-block-image size-large"><img src="${news.media.localPath}" alt="${news.title}" /></figure>`;
}

function facebookRestoredNewsListItem(news) {
  return `<li><a href="${news.path}">${news.title}</a><time datetime="${news.date}">${news.date.slice(0, 10)}</time><p>${news.excerpt}</p></li>`;
}

const NEWS_CATEGORY_PATH = "/category/ข่าวและกิจกรรม";

function noGiftPolicyContentHtml() {
  const paragraphs = NO_GIFT_POLICY_PARAGRAPHS.map(
    (paragraph) => `<p>${paragraph}</p>`,
  ).join("\n\n");
  const gallery = NO_GIFT_POLICY_MEDIA.map(
    (image) =>
      `<figure class="wp-block-image size-large"><img src="${image.localPath}" alt="${NO_GIFT_POLICY_NEWS.title}" /></figure>`,
  ).join("\n");

  return `${paragraphs}\n\n${gallery}`;
}

function noGiftPolicyListItem() {
  return `<li><a href="${NO_GIFT_POLICY_NEWS.path}">${NO_GIFT_POLICY_NEWS.title}</a><time datetime="${NO_GIFT_POLICY_NEWS.date}">24 ก.พ. 2569</time><p>${NO_GIFT_POLICY_NEWS.excerpt}</p></li>`;
}

function withSupplementalRecords(records) {
  const existingPaths = new Set(records.map((record) => record.path));
  const supplementalNews = FACEBOOK_RESTORED_NEWS.map((news) => ({
    id: `th-post-${news.id}`,
    wpId: news.wpId,
    language: "th",
    kind: "post",
    path: news.path,
    sourceUrl: news.sourceUrl,
    title: news.title,
    excerpt: news.excerpt,
    contentHtml: facebookRestoredNewsContentHtml(news),
    searchText: [news.title, news.excerpt, ...news.paragraphs].join("\n"),
    date: news.date,
    modified: "2026-06-29T00:00:00",
    parentPath: null,
    categoryIds: [7],
    featuredMediaId: Number(news.media.id),
    authorId: null,
  }));

  const listItems = [
    ...FACEBOOK_RESTORED_NEWS.filter((news) => !existingPaths.has(news.path)).map(
      facebookRestoredNewsListItem,
    ),
    existingPaths.has(NO_GIFT_POLICY_NEWS.path) ? "" : noGiftPolicyListItem(),
  ]
    .filter(Boolean)
    .join("\n");

  const nextRecords = records.map((record) => {
    if (record.path !== NEWS_CATEGORY_PATH || !listItems) {
      return record;
    }

    return {
      ...record,
      contentHtml: record.contentHtml.replace(
        /<ul class="wp-import-list">/,
        `<ul class="wp-import-list">
${listItems}`,
      ),
      modified: "2026-06-29T00:00:00",
    };
  });

  const additions = supplementalNews.filter((news) => !existingPaths.has(news.path));

  if (!existingPaths.has(NO_GIFT_POLICY_NEWS.path)) {
    additions.push({
      ...NO_GIFT_POLICY_NEWS,
      contentHtml: noGiftPolicyContentHtml(),
      searchText: [
        NO_GIFT_POLICY_NEWS.title,
        NO_GIFT_POLICY_NEWS.excerpt,
        ...NO_GIFT_POLICY_PARAGRAPHS,
      ].join("\n"),
    });
  }

  return [...nextRecords, ...additions];
}

function withSupplementalCategories(categories, records) {
  const existingPaths = new Set(records.map((record) => record.path));
  const missingSupplementalCount = [
    NO_GIFT_POLICY_NEWS.path,
    ...FACEBOOK_RESTORED_NEWS.map((news) => news.path),
  ].filter((path) => !existingPaths.has(path)).length;

  return categories.map((category) => {
    if (category.id !== 7 || category.language !== "th") {
      return { ...category };
    }

    return { ...category, count: category.count + missingSupplementalCount };
  });
}

function withSupplementalMedia(media) {
  const existingIds = new Set(media.map((asset) => String(asset.id)));
  const facebookMedia = FACEBOOK_RESTORED_NEWS.map((news) => ({
    ...news.media,
    id: String(news.media.id),
  }));
  const supplemental = [...NO_GIFT_POLICY_MEDIA, ...facebookMedia].filter(
    (asset) => !existingIds.has(asset.id),
  );
  return [...media, ...supplemental];
}

function withSupplementalDownloads(downloads) {
  const existingIds = new Set(downloads.map((download) => download.id));
  const supplemental = ITA_2569_SUPPLEMENTAL_DOWNLOADS.filter(
    (download) => !existingIds.has(download.id),
  );

  return [...downloads, ...supplemental];
}

/**
 * Pure transforms turning the import manifest (src/data/wp-content.json) into
 * database rows for scripts/seed-db.mjs. No database access here.
 */

/**
 * Map a manifest to table rows. Records with a duplicate `path` are dropped
 * (first occurrence wins) because the site historically served the first
 * manifest match (`records.find`), and `ContentRecord.path` is unique.
 */
export function manifestToRows(manifest) {
  const records = [];
  const skippedDuplicates = [];
  const byPath = new Map();

  for (const record of withSupplementalRecords(manifest.records)) {
    const existing = byPath.get(record.path);
    if (existing) {
      skippedDuplicates.push({
        path: record.path,
        keptId: existing.id,
        droppedId: record.id,
      });
      continue;
    }
    const row = {
      id: record.id,
      wpId: String(record.wpId),
      language: record.language,
      kind: record.kind,
      path: record.path,
      sourceUrl: record.sourceUrl,
      title: record.title,
      excerpt: record.excerpt,
      contentHtml: record.contentHtml,
      searchText: record.searchText ?? "",
      date: record.date,
      modified: record.modified,
      parentPath: record.parentPath,
      categoryIds: record.categoryIds ?? [],
      featuredMediaId: record.featuredMediaId ?? null,
      authorId: record.authorId ?? null,
    };
    byPath.set(record.path, row);
    records.push(row);
  }

  return {
    records,
    skippedDuplicates,
    categories: withSupplementalCategories(manifest.categories, manifest.records),
    media: withSupplementalMedia(
      manifest.media.map((asset) => ({ ...asset, id: String(asset.id) })),
    ),
    downloads: withSupplementalDownloads(
      manifest.downloads.map((download) => ({ ...download })),
    ),
    meta: [
      { key: "generatedAt", value: manifest.generatedAt },
      { key: "source", value: manifest.source },
      { key: "navigation", value: manifest.navigation ?? { th: [], en: [] } },
    ],
  };
}
