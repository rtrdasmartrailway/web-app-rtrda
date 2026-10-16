import { describe, expect, it } from "vitest";
import {
  getRequestFormIssue,
  requestFormIssueMessage,
  type RequestFormValues,
} from "./request-form-validation";

const validPr: RequestFormValues = {
  type: "pr",
  title: "Rail safety update",
  assigner: "Communications Director",
  owner: "Project team",
  requestedDate: "2026-11-01",
  source: "https://example.org/source",
  confirmed: true,
  objective: "Explain the update",
  whyNow: "The change takes effect next month",
  audience: "Passengers",
  contentTypes: ["Website News"],
  priority: "NORMAL",
  priorityReason: "",
  projectDetails: "",
  startTime: "",
  endTime: "",
  travel: "RTRDA transport confirmed",
};

describe("request form validation", () => {
  it("accepts a complete PR request and validates every required field", () => {
    expect(getRequestFormIssue(validPr)).toBeNull();
    const cases: Array<[Partial<RequestFormValues>, RequestFormValues["type"], string]> =
      [
        [{ title: "  " }, "pr", "title"],
        [{ assigner: " " }, "pr", "assigner"],
        [{ owner: " " }, "pr", "owner"],
        [{ requestedDate: "" }, "pr", "requestedDate"],
        [{ source: "" }, "pr", "source"],
        [{ source: "http://example.org" }, "pr", "source"],
        [{ confirmed: false }, "pr", "confirmation"],
        [{ objective: " " }, "pr", "objective"],
        [{ whyNow: " " }, "pr", "whyNow"],
        [{ audience: " " }, "pr", "audience"],
        [{ contentTypes: [] }, "pr", "contentTypes"],
        [{ priority: "" }, "pr", "priority"],
      ];
    for (const [patch, type, expected] of cases) {
      expect(getRequestFormIssue({ ...validPr, ...patch, type })).toBe(expected);
    }
  });

  it("validates off-site times as a strictly increasing range", () => {
    const offsite: RequestFormValues = {
      ...validPr,
      type: "offsite",
      startTime: "09:00",
      endTime: "10:00",
    };
    expect(getRequestFormIssue(offsite)).toBeNull();
    expect(getRequestFormIssue({ ...offsite, startTime: "" })).toBe("startTime");
    expect(getRequestFormIssue({ ...offsite, endTime: "" })).toBe("endTime");
    expect(getRequestFormIssue({ ...offsite, endTime: "09:00" })).toBe("endTime");
    expect(getRequestFormIssue({ ...offsite, endTime: "08:59" })).toBe("endTime");
    expect(getRequestFormIssue({ ...offsite, travel: " " })).toBe("travel");
  });

  it("provides a localized actionable validation message", () => {
    expect(
      getRequestFormIssue({ ...validPr, contentTypes: ["Legacy type"] }, [
        "Website News",
      ]),
    ).toBe("contentTypes");
    expect(getRequestFormIssue({ ...validPr, requestedDate: "2026-02-30" })).toBe(
      "requestedDate",
    );
    expect(
      getRequestFormIssue({
        ...validPr,
        source: `${"https://example.org/"}\n`.repeat(101),
      }),
    ).toBe("source");
    expect(requestFormIssueMessage("contentTypes", true)).toContain("อย่างน้อย 1");
    expect(requestFormIssueMessage("contentTypes", false)).toBe(
      "Choose at least one content type.",
    );
  });
});
