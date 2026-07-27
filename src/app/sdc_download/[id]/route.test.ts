import { describe, expect, it } from "vitest";
import {
  contentDisposition,
  contentTypeForDownload,
  isInlineRequest,
} from "./download-response";
import type { WpDownloadAsset } from "@/lib/wp/types";
import { getStaticDownloadOverride } from "@/lib/wp/static-download-overrides";

const download: WpDownloadAsset = {
  id: "5540",
  sourceUrl: "https://www.rtrda.or.th/sdc_download/5540/?key=x",
  localPath: "/sdc-downloads/5540.pdf",
  fileName: "RTRDA_AR_2023-รวมเล่ม.pdf",
  mimeType: "application/octet-stream",
  sizeBytes: 29384913,
  title: "รายงานประจำปี 2566",
  group: "รายงานประจำปี",
  sourcePages: ["/คลังความรู้"],
};

describe("sdc_download route helpers", () => {
  it("keeps normal download responses as attachments", () => {
    expect(contentDisposition(download, false)).toContain("attachment;");
  });

  it("uses inline content disposition for reader requests", () => {
    expect(contentDisposition(download, true)).toContain("inline;");
  });

  it("treats mirrored .pdf downloads as PDF even when WordPress sent octet-stream", () => {
    expect(contentTypeForDownload(download)).toBe("application/pdf");
  });

  it("detects inline reader requests from the query string", () => {
    expect(
      isInlineRequest(new Request("https://test.rtrda.or.th/sdc_download/5540")),
    ).toBe(false);
    expect(
      isInlineRequest(new Request("https://test.rtrda.or.th/sdc_download/5540?inline=1")),
    ).toBe(true);
  });

  it("provides a safe fallback for every O19 supporting document", () => {
    for (let index = 1; index <= 7; index += 1) {
      const id = `ita2569-o19-0${index}`;
      const fallback = getStaticDownloadOverride(id);

      expect(fallback?.localPath).toBe(`/sdc-downloads/${id}.pdf`);
      expect(fallback?.mimeType).toBe("application/pdf");
    }
  });
});
