import { describe, expect, it } from "vitest";
import {
  latestReleaseEvidenceByGate,
  parseReleaseEvidenceInput,
} from "./release-evidence";

describe("release evidence", () => {
  it("requires a valid reference and non-future performed date", () => {
    const now = new Date("2026-09-15T00:00:00Z");
    expect(() =>
      parseReleaseEvidenceInput(
        {
          gateKey: "BACKUP_RESTORE",
          result: "PASSED",
          evidenceReference: "RESTORE-UAT-REFERENCE",
          performedAt: "2026-09-16T00:00:00Z",
        },
        now,
      ),
    ).toThrow();
  });

  it("uses the newest first record per gate", () => {
    const latest = latestReleaseEvidenceByGate([
      { gateKey: "BACKUP_RESTORE", result: "FAILED" },
      { gateKey: "BACKUP_RESTORE", result: "PASSED" },
      { gateKey: "NOT_A_GATE", result: "PASSED" },
    ]);
    expect(latest.BACKUP_RESTORE?.result).toBe("FAILED");
    expect(Object.keys(latest)).toEqual(["BACKUP_RESTORE"]);
  });
});
