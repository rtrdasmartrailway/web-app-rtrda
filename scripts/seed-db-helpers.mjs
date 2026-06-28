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
  const nextRecords = records.map((record) => {
    if (
      record.path !== NEWS_CATEGORY_PATH ||
      record.contentHtml.includes(NO_GIFT_POLICY_NEWS.path)
    ) {
      return record;
    }

    return {
      ...record,
      contentHtml: record.contentHtml.replace(
        /<ul class="wp-import-list">/,
        `<ul class="wp-import-list">\n${noGiftPolicyListItem()}`,
      ),
      modified: NO_GIFT_POLICY_NEWS.modified,
    };
  });

  if (existingPaths.has(NO_GIFT_POLICY_NEWS.path)) {
    return nextRecords;
  }

  return [
    ...nextRecords,
    {
      ...NO_GIFT_POLICY_NEWS,
      contentHtml: noGiftPolicyContentHtml(),
      searchText: [
        NO_GIFT_POLICY_NEWS.title,
        NO_GIFT_POLICY_NEWS.excerpt,
        ...NO_GIFT_POLICY_PARAGRAPHS,
      ].join("\n"),
    },
  ];
}

function withSupplementalCategories(categories, records) {
  const hasNewsRecord = records.some(
    (record) => record.path === NO_GIFT_POLICY_NEWS.path,
  );
  return categories.map((category) => {
    if (category.id !== 7 || category.language !== "th" || hasNewsRecord) {
      return { ...category };
    }

    return { ...category, count: category.count + 1 };
  });
}

function withSupplementalMedia(media) {
  const existingIds = new Set(media.map((asset) => String(asset.id)));
  const supplemental = NO_GIFT_POLICY_MEDIA.filter((asset) => !existingIds.has(asset.id));
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
