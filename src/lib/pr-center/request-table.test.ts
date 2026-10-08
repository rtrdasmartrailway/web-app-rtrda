import { describe, expect, it } from "vitest";
import { summarizeRequestTableTasks } from "./request-table";

describe("summarizeRequestTableTasks", () => {
  it("shows the total task count and at most three unique content types", () => {
    expect(
      summarizeRequestTableTasks([
        { contentType: "Website News", status: "draft" },
        { contentType: "Facebook Post", status: "draft" },
        { contentType: "Website News", status: "in_production" },
        { contentType: "Infographic", status: "draft" },
        { contentType: "Carousel", status: "draft" },
      ]),
    ).toEqual({
      count: 5,
      contentTypes: ["Website News", "Facebook Post", "Infographic"],
      status: "in_production",
    });
  });

  it("uses the workflow priority to summarize mixed task statuses", () => {
    expect(
      summarizeRequestTableTasks([
        { contentType: "Post", status: "published" },
        { contentType: "Video", status: "revision_required" },
      ]).status,
    ).toBe("revision_required");
  });

  it("reports published when every task is published or closed", () => {
    expect(
      summarizeRequestTableTasks([
        { contentType: "Post", status: "published" },
        { contentType: "Video", status: "closed" },
      ]).status,
    ).toBe("published");
  });

  it("returns draft and no content types for a request without tasks", () => {
    expect(summarizeRequestTableTasks([])).toEqual({
      count: 0,
      contentTypes: [],
      status: "draft",
    });
  });
});
