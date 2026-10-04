import { describe, expect, it } from "vitest";
import { parseIdeaListPage } from "./idea-view";

const record = {
  id: "idea-1",
  title: "Public transport research",
  rationale: "Explain the study results",
  proposerId: "user-1",
  audience: "Public",
  pillar: "Research",
  channel: "Website",
  priority: "Normal",
  campaign: null,
  evidenceUrls: ["https://example.com/source"],
  status: "PROPOSED",
  createdAt: "2026-10-01T00:00:00.000Z",
  convertedRequestId: null,
  version: 1,
};

describe("parseIdeaListPage", () => {
  it("accepts scoped list fields, version, and pagination metadata", () => {
    expect(parseIdeaListPage({ items: [record], nextOffset: 50 })).toEqual({
      items: [record],
      nextOffset: 50,
    });
  });

  it("accepts the final page and rejects malformed list payloads", () => {
    expect(parseIdeaListPage({ items: [], nextOffset: null })).toEqual({
      items: [],
      nextOffset: null,
    });
    expect(() => parseIdeaListPage([record])).toThrow(
      "Invalid Content Ideas list response",
    );
    expect(() =>
      parseIdeaListPage({ items: [{ ...record, version: 0 }], nextOffset: null }),
    ).toThrow("Invalid Content Ideas list response");
  });
});
