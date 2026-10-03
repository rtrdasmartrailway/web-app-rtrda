import { beforeEach, describe, expect, it, vi } from "vitest";

const { counts } = vi.hoisted(() => ({
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
}));

vi.mock("@/lib/db/client", () => ({ prisma: counts }));

import { releaseReadinessCheck } from "./service";

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

  it("restricts readiness results to scoped administrators", async () => {
    await expect(
      releaseReadinessCheck({ ...administrator, role: "REQUESTER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});
