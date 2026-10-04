import { describe, expect, it } from "vitest";
import { normalizeCreateIdeaInput } from "./idea-input";

describe("normalizeCreateIdeaInput", () => {
  it("trims and preserves all structured metadata and canonical HTTPS evidence", () => {
    expect(
      normalizeCreateIdeaInput({
        title: "  Safer road travel  ",
        rationale: "  Explain the safety campaign  ",
        audience: "  Commuters  ",
        pillar: "  Safety  ",
        channel: "  Facebook  ",
        priority: "  High  ",
        campaign: "  Road safety  ",
        evidenceUrls: ["https://example.org/source", "  "],
      }),
    ).toEqual({
      title: "Safer road travel",
      rationale: "Explain the safety campaign",
      audience: "Commuters",
      pillar: "Safety",
      channel: "Facebook",
      priority: "High",
      campaign: "Road safety",
      evidenceUrls: ["https://example.org/source"],
    });
  });

  it("rejects missing or out-of-range title and rationale", () => {
    expect(() =>
      normalizeCreateIdeaInput({ title: "ab", rationale: "valid rationale" }),
    ).toThrow("Idea title must contain 3 to 300 characters");
    expect(() =>
      normalizeCreateIdeaInput({ title: "valid title", rationale: "  " }),
    ).toThrow("Idea rationale must contain 3 to 5000 characters");
  });

  it("rejects non-text metadata and evidence values", () => {
    expect(() =>
      normalizeCreateIdeaInput({
        title: "valid title",
        rationale: "valid rationale",
        pillar: 12,
      }),
    ).toThrow("Idea pillar must be text");
    expect(() =>
      normalizeCreateIdeaInput({
        title: "valid title",
        rationale: "valid rationale",
        evidenceUrls: "https://example.org",
      }),
    ).toThrow("Idea evidence must be a list of HTTPS URLs");
  });

  it("rejects non-HTTPS, credential-bearing, and malformed evidence URLs", () => {
    for (const url of [
      "http://example.org",
      "https://user:pass@example.org",
      "not a url",
    ]) {
      expect(() =>
        normalizeCreateIdeaInput({
          title: "valid title",
          rationale: "valid rationale",
          evidenceUrls: [url],
        }),
      ).toThrow("Idea evidence URLs must be valid HTTPS URLs without credentials");
    }
  });

  it("limits evidence URL count and optional text lengths", () => {
    expect(() =>
      normalizeCreateIdeaInput({
        title: "valid title",
        rationale: "valid rationale",
        evidenceUrls: Array.from(
          { length: 21 },
          (_, index) => `https://example.org/${index}`,
        ),
      }),
    ).toThrow("An idea may include at most 20 evidence URLs");
    expect(() =>
      normalizeCreateIdeaInput({
        title: "valid title",
        rationale: "valid rationale",
        campaign: "x".repeat(201),
      }),
    ).toThrow("Idea campaign must contain at most 200 characters");
  });
});
