import { describe, expect, it } from "vitest";
import {
  bangkokDateKey,
  bangkokCalendarAnchor,
  parseCalendarEntries,
  parseCalendarRequestDecisions,
} from "./calendar-view";

describe("Bangkok calendar date boundaries", () => {
  it("uses Bangkok calendar days for UTC timestamps", () => {
    expect(bangkokDateKey("2026-10-11T18:00:00.000Z")).toBe("2026-10-12");
    expect(
      bangkokCalendarAnchor(new Date("2026-10-11T18:00:00.000Z")).toISOString(),
    ).toBe("2026-10-12T00:00:00.000Z");
  });
});

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
        publishedUrl: null,
        publishedReference: null,
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
        publishedUrl: "https://example.org/published",
        publishedReference: "post-123",
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

  it("rejects malformed publication evidence fields", () => {
    expect(() =>
      parseCalendarEntries([
        {
          id: "schedule-1",
          taskId: "task-1",
          title: "Story",
          requestNumber: "PR-2026-001",
          channel: "Website",
          taskRevision: 1,
          date: "2026-10-10T09:00:00.000Z",
          status: "PUBLISHED",
          publishedUrl: 42,
        },
      ]),
    ).toThrow("Invalid calendar response");
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

describe("parseCalendarRequestDecisions", () => {
  it("accepts only request approvals and rejections with attribution", () => {
    expect(
      parseCalendarRequestDecisions([
        {
          id: "history-1",
          requestId: "request-1",
          requestNumber: "PR-2026-001",
          title: "Station opening",
          decision: "REJECTED",
          reason: "Missing source",
          actorName: "PR Operations",
          date: "2026-10-12T03:15:00.000Z",
        },
      ]),
    ).toMatchObject([{ decision: "REJECTED", reason: "Missing source" }]);
  });

  it("rejects unsupported or malformed activity", () => {
    expect(() => parseCalendarRequestDecisions([{ decision: "SUBMITTED" }])).toThrow(
      "Invalid calendar decision response",
    );
  });
});
