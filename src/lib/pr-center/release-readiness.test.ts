import { beforeEach, describe, expect, it, vi } from "vitest";

const { counts, findEvidence, createEvidence } = vi.hoisted(() => ({
  counts: {
    prAuditEvent: { count: vi.fn() },
    prRequest: { count: vi.fn() },
    prApproval: { count: vi.fn() },
    prFileObject: { count: vi.fn() },
    prSchedule: { count: vi.fn() },
    prTask: { count: vi.fn() },
    prNotification: { count: vi.fn() },
    prOutboxEvent: { count: vi.fn() },
  },
  findEvidence: vi.fn(),
  createEvidence: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    ...counts,
    prAuditEvent: {
      ...counts.prAuditEvent,
      findMany: findEvidence,
      create: createEvidence,
    },
  },
}));

import { recordReleaseEvidence, releaseReadinessCheck } from "./service";

const administrator = {
  id: "admin",
  organizationId: "org-1",
  departmentId: null,
  role: "SCOPED_ADMINISTRATOR" as const,
};

function check(result: Awaited<ReturnType<typeof releaseReadinessCheck>>, name: string) {
  return result.checks.find((item) => item.name === name);
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(counts)) model.count.mockResolvedValue(0);
  findEvidence.mockResolvedValue([]);
  createEvidence.mockResolvedValue({
    id: "evidence-1",
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });
});

describe("releaseReadinessCheck", () => {
  it("does not report empty workflow data as passed", async () => {
    const result = await releaseReadinessCheck(administrator);
    expect(result.ready).toBe(false);
    expect(check(result, "Request lifecycle coverage")?.passed).toBe(false);
    expect(check(result, "Approval decisions")?.passed).toBe(false);
    expect(check(result, "File lifecycle")?.passed).toBe(false);
    expect(check(result, "Publishing pipeline")?.passed).toBe(false);
    expect(check(result, "Notification system")?.passed).toBe(false);
    expect(check(result, "Outbox events")?.passed).toBe(true);
  });

  it("keeps release blocked for unconfigured policy/infrastructure even with sample records", async () => {
    for (const model of Object.values(counts)) model.count.mockResolvedValue(5);
    const result = await releaseReadinessCheck(administrator);
    expect(result.ready).toBe(false);
    expect(check(result, "Malware scanner integration")?.passed).toBe(false);
    expect(check(result, "External notification delivery")?.passed).toBe(false);
    expect(check(result, "Outbox worker")?.passed).toBe(false);
    expect(check(result, "Approval authority policy")?.passed).toBe(false);
    expect(check(result, "Backup and restore UAT")?.passed).toBe(false);
    expect(check(result, "Role/scope and security UAT")?.passed).toBe(false);
  });

  it("uses the latest signed evidence status for release gates", async () => {
    findEvidence.mockResolvedValue([
      {
        id: "evidence-latest",
        after: {
          gateKey: "BACKUP_RESTORE",
          result: "PASSED",
          evidenceReference: "RESTORE-UAT-2026-09-01",
          notes: "Database and private files restored",
          performedAt: "2026-09-01T00:00:00.000Z",
        },
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
        actor: { displayName: "Release Owner", email: "owner@rtrda.or.th" },
      },
      {
        id: "evidence-older",
        after: {
          gateKey: "BACKUP_RESTORE",
          result: "FAILED",
          evidenceReference: "OLD-RESTORE-TEST",
          performedAt: "2026-08-01T00:00:00.000Z",
        },
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
        actor: { displayName: "Release Owner", email: "owner@rtrda.or.th" },
      },
    ]);
    const result = await releaseReadinessCheck(administrator);
    expect(check(result, "Backup and restore UAT")?.passed).toBe(true);
    expect(check(result, "Backup and restore UAT")?.detail).toContain(
      "RESTORE-UAT-2026-09-01",
    );
  });

  it("restricts readiness results to scoped administrators", async () => {
    await expect(
      releaseReadinessCheck({ ...administrator, role: "REQUESTER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("records signed release evidence as an append-only audit event", async () => {
    const saved = await recordReleaseEvidence(
      administrator,
      {
        gateKey: "BACKUP_RESTORE",
        result: "PASSED",
        evidenceReference: "RESTORE-UAT-2026-09-01",
        notes: "Database and private files restored",
        performedAt: "2026-09-01T00:00:00.000Z",
      },
      "correlation-1",
    );
    expect(createEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: administrator.id,
          action: "release.evidence.recorded",
          entityId: "BACKUP_RESTORE",
          correlationId: "correlation-1",
        }),
      }),
    );
    expect(saved.signedBy).toBe(administrator.id);
  });

  it("rejects release evidence from non-organization administrators", async () => {
    await expect(
      recordReleaseEvidence(
        { ...administrator, role: "PR_OPERATIONS" },
        {
          gateKey: "BACKUP_RESTORE",
          result: "PASSED",
          evidenceReference: "RESTORE-UAT-2026-09-01",
          performedAt: "2026-09-01T00:00:00.000Z",
        },
        "correlation-2",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});
