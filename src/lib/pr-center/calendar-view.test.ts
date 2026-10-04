import { describe, expect, it } from "vitest";
import { parseCalendarEntries } from "./calendar-view";

describe("parseCalendarEntries", () => {
  it("accepts scheduled, published, and draft entries with distinct date meaning", () => {
    const entries = [
      {
        id: "schedule-1",
        taskId: "task-1",
        title: "Scheduled story",
        requestNumber: "PR-2026-001",
        channel: "Website",
        taskRevision: 2,
        date: "2026-10-10T09:00:00.000Z",
        status: "SCHEDULED",
      },
      {
        id: "schedule-2",
        taskId: "task-2",
        title: "Published story",
        requestNumber: "PR-2026-002",
        channel: "Facebook",
        taskRevision: 1,
        date: "2026-10-11T10:00:00.000Z",
        status: "PUBLISHED",
      },
      {
        id: "task-3",
        taskId: "task-3",
        title: "Draft story",
        requestNumber: "PR-2026-003",
        channel: null,
        taskRevision: null,
        date: "2026-10-12T11:00:00.000Z",
        status: "DRAFT",
        contentType: "Website News",
      },
    ];

    expect(parseCalendarEntries(entries)).toEqual(entries);
  });

  it("rejects malformed entries instead of presenting local/demo dates", () => {
    expect(() => parseCalendarEntries({ entries: [] })).toThrow(
      "Invalid calendar response",
    );
    expect(() =>
      parseCalendarEntries([
        {
          id: "schedule-1",
          taskId: "task-1",
          title: "Story",
          requestNumber: "PR-2026-001",
          channel: "Website",
          taskRevision: 1,
          date: "tomorrow",
          status: "SCHEDULED",
        },
      ]),
    ).toThrow("Invalid calendar response");
  });
});
