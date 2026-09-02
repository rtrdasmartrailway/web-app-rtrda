import { describe, expect, it } from "vitest";
import { hasDocumentPreviewToken, issueDocumentPreviewToken } from "./document-preview";

describe("document preview tokens", () => {
  it("allows the matching document until the token expires", () => {
    const now = Date.now();
    const token = issueDocumentPreviewToken("rail-technology-strategy-2571-2575", now);

    expect(
      hasDocumentPreviewToken("rail-technology-strategy-2571-2575", token, now),
    ).toBe(true);
    expect(
      hasDocumentPreviewToken("rail-technology-strategy-2571-2575", "wrong", now),
    ).toBe(false);
    expect(
      hasDocumentPreviewToken(
        "rail-technology-strategy-2571-2575",
        token,
        now + 5 * 60 * 1000,
      ),
    ).toBe(false);
  });
});
