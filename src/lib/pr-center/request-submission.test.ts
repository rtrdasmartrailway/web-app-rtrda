import { describe, expect, it } from "vitest";
import { validateRequestSubmission } from "./request-submission";

const allowed = new Set(["Website News", "Short Video"]);
const complete = () => ({
  type: "PR",
  title: "Rail research update",
  requestedFor: new Date("2026-11-20T00:00:00Z"),
  sourceUrls: ["https://example.org/brief"],
  objective: "Explain the research",
  audience: "Rail passengers",
  details: {
    projectOwner: "Research lead",
    assigner: "Director",
    confirmed: true,
    whyNow: "Results are ready",
    contentTypes: ["Website News"],
    priorityReason: "",
    projectDetails: "",
  } as Record<string, unknown>,
});

describe("canonical request submission completeness", () => {
  it("accepts complete PR and off-site requests", () => {
    expect(() => validateRequestSubmission(complete(), allowed)).not.toThrow();
    expect(() =>
      validateRequestSubmission(
        {
          ...complete(),
          type: "OFFSITE",
          objective: null,
          audience: null,
          details: {
            projectOwner: "Owner",
            assigner: "Director",
            confirmed: true,
            startTime: "09:00",
            endTime: "10:30",
            travel: "Agency vehicle",
          },
        },
        allowed,
      ),
    ).not.toThrow();
  });

  it.each([
    ["title", "  "],
    ["title", "x".repeat(301)],
    ["type", "OTHER"],
    ["requestedFor", null],
    ["requestedFor", new Date("invalid")],
    ["sourceUrls", []],
    ["sourceUrls", ["http://example.org"]],
    ["sourceUrls", ["https://example.org/" + "x".repeat(2048)]],
    ["sourceUrls", Array(101).fill("https://example.org")],
    ["objective", " "],
    ["objective", "x".repeat(5001)],
    ["audience", null],
    ["audience", "x".repeat(5001)],
    ["details", null],
    ["priorityReason", "x".repeat(1001)],
  ])("rejects invalid %s", (field, value) => {
    expect(() =>
      validateRequestSubmission({ ...complete(), [field]: value }, allowed),
    ).toThrow();
  });

  it.each([
    ["projectOwner", " "],
    ["projectOwner", "x".repeat(201)],
    ["assigner", null],
    ["assigner", "x".repeat(201)],
    ["confirmed", false],
    ["confirmed", "true"],
    ["whyNow", " "],
    ["whyNow", "x".repeat(5001)],
    ["contentTypes", []],
    ["contentTypes", ["Retired type"]],
    ["contentTypes", [null]],
    ["contentTypes", "Website News"],
    ["contentTypes", ["Website News", ""]],
    ["contentTypes", Array(101).fill("Website News")],
    ["priorityReason", "x".repeat(1001)],
    ["projectDetails", "x".repeat(5001)],
  ])("rejects malformed or incomplete detail %s", (field, value) => {
    const request = complete();
    expect(() =>
      validateRequestSubmission(
        { ...request, details: { ...request.details, [field]: value } },
        allowed,
      ),
    ).toThrow();
  });

  it.each([
    { startTime: "25:00" },
    { endTime: "" },
    { endTime: "09:00" },
    { endTime: "08:00" },
    { endTime: "9:30" },
    { travel: " " },
    { travel: "x".repeat(201) },
    { contentTypes: ["Retired type"] },
  ])("rejects invalid off-site details %j", (change) => {
    const request = complete();
    expect(() =>
      validateRequestSubmission(
        {
          ...request,
          type: "OFFSITE",
          details: {
            ...request.details,
            startTime: "09:00",
            endTime: "10:00",
            travel: "Agency vehicle",
            ...change,
          },
        },
        allowed,
      ),
    ).toThrow();
  });

  it("accepts exact field limits and does not mutate persisted details", () => {
    const request = complete();
    request.title = "x".repeat(300);
    request.objective = request.audience = "x".repeat(5000);
    request.details = {
      ...request.details,
      projectOwner: "x".repeat(200),
      assigner: "x".repeat(200),
      whyNow: "x".repeat(5000),
      priorityReason: "x".repeat(1000),
      projectDetails: "x".repeat(5000),
    };
    const before = structuredClone(request);
    validateRequestSubmission(request, allowed);
    expect(request).toEqual(before);
  });
});
