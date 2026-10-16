import { describe, expect, it } from "vitest";
import {
  getRequestFormIssue,
  getRequestFormErrorMessage,
} from "./request-form-submission";
const valid = {
  type: "pr" as "pr" | "offsite",
  title: "Fixture project",
  owner: "Owner",
  assigner: "Manager",
  objective: "Inform",
  audience: "Public",
  source: "https://example.test/brief",
  requestedDate: "2026-11-20",
  whyNow: "Milestone",
  contentTypes: ["Website News"],
  confirmed: true,
  priorityReason: "",
  projectDetails: "",
  startTime: "09:00",
  endTime: "10:00",
  travel: "Agency transport",
};
describe("request form mirrors canonical submission validation", () => {
  it("accepts a complete PR", () => expect(getRequestFormIssue(valid)).toBeNull());
  it("accepts offsite without PR-only fields", () =>
    expect(
      getRequestFormIssue({
        ...valid,
        type: "offsite",
        objective: "",
        audience: "",
        whyNow: "",
        contentTypes: [],
      }),
    ).toBeNull());
  it.each([
    { title: "" },
    { title: "ab" },
    { title: "x".repeat(301) },
    { requestedDate: "" },
    { requestedDate: "not-date" },
    { source: "" },
    { source: "http://example.test/brief" },
    { owner: "" },
    { assigner: "" },
    { confirmed: false },
    { objective: "" },
    { audience: "" },
    { whyNow: "" },
    { contentTypes: [] },
    { priorityReason: "x".repeat(1001) },
    { projectDetails: "x".repeat(5001) },
  ])("rejects incomplete or malformed fields %j", (change) => {
    const issue = getRequestFormIssue({ ...valid, ...change });
    expect(issue).not.toBeNull();
    expect(getRequestFormErrorMessage(issue!, "th")).toMatch(/[ก-๙]/);
  });
  it("checks current master content types", () =>
    expect(getRequestFormIssue(valid, ["Custom type"])).not.toBeNull());
  it.each([
    { startTime: "" },
    { endTime: "" },
    { endTime: "08:00" },
    { travel: "" },
    { travel: "x".repeat(201) },
  ])("rejects invalid offsite fields %j", (change) =>
    expect(getRequestFormIssue({ ...valid, type: "offsite", ...change })).not.toBeNull(),
  );
  it("retains English error detail", () =>
    expect(getRequestFormErrorMessage("Audience is required", "en")).toBe(
      "Audience is required",
    ));
});
