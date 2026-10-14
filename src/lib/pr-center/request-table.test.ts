import { describe, expect, it } from "vitest";
import {
  requestIntakeStatusLabel,
  requestTableStatusLabel,
  summarizeRequestTableTasks,
} from "./request-table";

describe("requestIntakeStatusLabel", () => {
  it("uses parent request status, not the aggregate task status", () => {
    expect(requestIntakeStatusLabel("SUBMITTED", "th")).toBe("ส่งแล้ว · รอพิจารณา");
    expect(requestIntakeStatusLabel("SUBMITTED", "en")).toBe(
      "Submitted · awaiting review",
    );
    expect(requestIntakeStatusLabel(undefined, "th")).toBe("—");
  });
});

describe("summarizeRequestTableTasks", () => {
  it("localizes the status for the selected table language", () => {
    expect(requestTableStatusLabel("scheduled", "th")).toBe("กำหนดเผยแพร่");
    expect(requestTableStatusLabel("scheduled", "en")).toBe("Scheduled");
  });

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
