import fs from "node:fs";
const PATH = "/srv/workspace/web-app-rtrda/src/data/wp-content.json";
const json = JSON.parse(fs.readFileSync(PATH, "utf-8"));
const page = json.records.find((r) => r.path === "/เกี่ยวกับ-สทร/ค่านิยมองค์กร");
if (!page) {
  console.error("Page not found in JSON");
  process.exit(1);
}

let html = page.contentHtml;
const BANNER = `<div class="values-letters"><span class="vl-letter">R</span><span class="vl-letter">T</span><span class="vl-letter">R</span><span class="vl-letter">D</span><span class="vl-letter">A</span></div>`;
if (html.includes("values-letters")) {
  console.log("Already mirrored — skipping");
  process.exit(0);
}
page.contentHtml = BANNER + "\n" + html;
fs.writeFileSync(PATH, JSON.stringify(json, null, 2));
console.log("JSON mirrored. New length:", page.contentHtml.length);
