import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { servePublicDocument } from "./public-file";
import { isPublicDocumentPath } from "./activity-contract";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe("recruitment inline PDF delivery", () => {
  it("uses the same document handler as risk reports", () => {
    expect(isPublicDocumentPath("/recruitment-documents/notice.pdf")).toBe(true);
    expect(isPublicDocumentPath("/recruitment-documents-other/notice.pdf")).toBe(false);
  });
  it("serves inline, uncached and range-capable PDF bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "recruitment-inline-test-"));
    roots.push(root);
    await mkdir(path.join(root, "recruitment-documents"));
    await writeFile(
      path.join(root, "recruitment-documents/notice.pdf"),
      "%PDF-1.3\nfixture",
    );
    const url = "https://test.rtrda.or.th/recruitment-documents/notice.pdf";
    const response = await servePublicDocument(
      new Request(url),
      "/recruitment-documents/notice.pdf",
      root,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(await response.text()).toBe("%PDF-1.3\nfixture");
    const ranged = await servePublicDocument(
      new Request(url, { headers: { range: "bytes=0-3" } }),
      "/recruitment-documents/notice.pdf",
      root,
    );
    expect(ranged.status).toBe(206);
    expect(await ranged.text()).toBe("%PDF");
  });
});
