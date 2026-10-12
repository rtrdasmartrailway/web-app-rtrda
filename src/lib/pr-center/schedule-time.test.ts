import { describe, expect, it } from "vitest";
import {
  bangkokLocalDateTimeToISOString,
  parseAbsoluteScheduleDate,
} from "./schedule-time";

describe("PR Center schedule timestamps", () => {
  it("interprets datetime-local values as Asia/Bangkok and emits UTC ISO", () => {
    expect(bangkokLocalDateTimeToISOString("2026-10-13T09:00")).toBe(
      "2026-10-13T02:00:00.000Z",
    );
  });

  it("rejects empty, malformed, and impossible Bangkok local times", () => {
    expect(bangkokLocalDateTimeToISOString("")).toBeNull();
    expect(bangkokLocalDateTimeToISOString("2026-10-13 09:00")).toBeNull();
    expect(bangkokLocalDateTimeToISOString("2026-02-30T09:00")).toBeNull();
  });

  it("parses an absolute timestamp with an explicit timezone offset", () => {
    expect(parseAbsoluteScheduleDate("2026-10-13T09:00:00+07:00").toISOString()).toBe(
      "2026-10-13T02:00:00.000Z",
    );
    expect(parseAbsoluteScheduleDate("2026-10-13T02:00:00Z").toISOString()).toBe(
      "2026-10-13T02:00:00.000Z",
    );
  });

  it("rejects timezone-less or invalid absolute timestamps", () => {
    expect(Number.isNaN(parseAbsoluteScheduleDate("2026-10-13T09:00:00").getTime())).toBe(
      true,
    );
    expect(Number.isNaN(parseAbsoluteScheduleDate("invalidZ").getTime())).toBe(true);
  });
});
