import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    prOrganizationSetting: { upsert: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      prOrganizationSetting: { findUnique: vi.fn() },
      prDepartment: { findMany: vi.fn() },
      $transaction: vi.fn((callback) => callback(tx)),
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));

import { getPrMasterData, savePrMasterData } from "./service";

const actor = {
  id: "root-admin",
  organizationId: "org-1",
  departmentId: null,
  role: "SCOPED_ADMINISTRATOR" as const,
  scopeDepartmentId: null,
};

describe("PR Center master data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.prOrganizationSetting.findUnique.mockResolvedValue(null);
    mocks.prisma.prDepartment.findMany.mockResolvedValue([{ name: "Communications" }]);
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.prOrganizationSetting.upsert.mockResolvedValue({ id: "setting-1" });
    mocks.tx.prAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    mocks.tx.prOutboxEvent.create.mockResolvedValue({ id: "outbox-1" });
  });

  it("returns handoff defaults and live departments until an organization overrides them", async () => {
    const data = await getPrMasterData({ ...actor, role: "REQUESTER" });
    expect(data.channels).toEqual([
      "Website",
      "Facebook",
      "TikTok",
      "YouTube",
      "X",
      "LinkedIn",
      "Press Release",
      "Internal",
    ]);
    expect(data.contentTypes).toContain("Executive Brief");
    expect(data.contentPillars).toContain("P08 National Impact");
    expect(data.departments).toEqual(["Communications"]);
  });

  it("persists unique channel, content-type, and pillar values with audit evidence", async () => {
    await savePrMasterData(
      actor,
      {
        channels: ["Website", "Facebook", "Website"],
        contentTypes: ["Website News", "Press Release"],
        contentPillars: ["P01 Rail Explained", "P01 Rail Explained"],
      },
      "corr-1",
    );

    expect(mocks.tx.prOrganizationSetting.upsert).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: "org-1", key: "pr-master-data" } },
      create: {
        organizationId: "org-1",
        key: "pr-master-data",
        value: {
          channels: ["Website", "Facebook"],
          contentTypes: ["Website News", "Press Release"],
          contentPillars: ["P01 Rail Explained"],
        },
      },
      update: {
        value: {
          channels: ["Website", "Facebook"],
          contentTypes: ["Website News", "Press Release"],
          contentPillars: ["P01 Rail Explained"],
        },
      },
    });
    expect(mocks.tx.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "pr.master_data.updated" }),
      }),
    );
  });

  it("requires an organization-wide administrator grant to edit master data", async () => {
    await expect(
      savePrMasterData(
        { ...actor, role: "PR_OPERATIONS", scopeDepartmentId: "dept-1" },
        {
          channels: ["Website"],
          contentTypes: ["Website News"],
          contentPillars: ["P01 Rail Explained"],
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
