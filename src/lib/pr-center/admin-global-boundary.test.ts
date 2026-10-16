import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    prOrganizationSetting: { upsert: vi.fn() },
    prAuditEvent: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    prRequest: { count: vi.fn() },
    prApproval: { count: vi.fn() },
    prFileObject: { count: vi.fn() },
    prTask: { count: vi.fn() },
    prSchedule: { count: vi.fn() },
    prNotification: { count: vi.fn() },
    prOutboxEvent: { count: vi.fn(), create: vi.fn() },
    prCenterUser: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma, scanner: vi.fn(), fetch: vi.fn() };
});
vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));
vi.mock("./malware-scanner", () => ({ isClamAvAvailable: mocks.scanner }));

import {
  exportAuditEvents,
  listReleaseEvidence,
  recordReleaseEvidence,
  releaseReadinessCheck,
  savePrMasterData,
  type PrCenterActor,
  type PrCenterRoleGrant,
} from "./service";

const admin: PrCenterActor = {
  id: "admin-1",
  organizationId: "org-1",
  departmentId: "home",
  role: "RTRDA_ALL_USER",
  roleGrants: [{ role: "RTRDA_ADMIN", departmentId: null }],
};
const master = {
  channels: ["Website"],
  contentTypes: ["News"],
  contentPillars: ["Rail"],
};
const evidence = {
  gateKey: "BACKUP_RESTORE",
  result: "PASSED",
  evidenceReference: "RESTORE-2026-01",
  notes: "Verified private files and database",
  performedAt: "2026-01-01T00:00:00.000Z",
};
const signedAt = new Date("2026-01-02T00:00:00Z");
const operations = {
  master: (actor: PrCenterActor) => savePrMasterData(actor, master, "corr-master"),
  export: (actor: PrCenterActor) => exportAuditEvents(actor, {}, "corr-export"),
  list: (actor: PrCenterActor) => listReleaseEvidence(actor),
  record: (actor: PrCenterActor) =>
    recordReleaseEvidence(actor, evidence, "corr-evidence"),
  readiness: (actor: PrCenterActor) => releaseReadinessCheck(actor),
};
function expectNoIO() {
  for (const model of Object.values(mocks.prisma)) {
    if (typeof model === "function") expect(model).not.toHaveBeenCalled();
    else for (const method of Object.values(model)) expect(method).not.toHaveBeenCalled();
  }
  expect(mocks.scanner).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("PR_CENTER_OUTBOX_WORKER_URL", "");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.prisma));
  mocks.prisma.prOrganizationSetting.upsert.mockResolvedValue({ id: "setting-1" });
  mocks.prisma.prAuditEvent.findMany.mockResolvedValue([]);
  mocks.prisma.prAuditEvent.create.mockResolvedValue({
    id: "event-1",
    createdAt: signedAt,
  });
  mocks.prisma.prCenterUser.findMany.mockResolvedValue([{ id: "admin-1" }]);
  for (const model of Object.values(mocks.prisma)) {
    if (typeof model === "object" && "count" in model) model.count.mockResolvedValue(0);
  }
  mocks.scanner.mockResolvedValue(false);
});

describe("organization-wide ADMIN grant boundary", () => {
  const deniedGrants: PrCenterRoleGrant[][] = [
    [],
    [{ role: "RTRDA_ADMIN", departmentId: "dept-a" }],
    [
      { role: "RTRDA_ADMIN", departmentId: "dept-a" },
      { role: "RTRDA_ADMIN", departmentId: "dept-b" },
    ],
    ...(["RTRDA_PR", "RTRDA_BORD", "RTRDA_ALL_USER"] as const).flatMap((role) => [
      [{ role, departmentId: null }],
      [
        { role: "RTRDA_ADMIN" as const, departmentId: "dept-a" },
        { role, departmentId: null },
      ],
    ]),
  ];
  for (const [name, operation] of Object.entries(operations)) {
    it.each(deniedGrants.map((roleGrants) => ({ roleGrants })))(
      `${name}: denies $roleGrants without any reads or writes`,
      async ({ roleGrants }) => {
        await expect(
          operation({ ...admin, role: "RTRDA_ADMIN", roleGrants }),
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
        expectNoIO();
      },
    );
    it.each([false, true])(
      `${name}: unions eligible tuples independent of grant order (%s)`,
      async (reverse) => {
        const roleGrants: PrCenterRoleGrant[] = [
          { role: "RTRDA_PR", departmentId: null },
          { role: "RTRDA_ADMIN", departmentId: "dept-b" },
          { role: "RTRDA_ADMIN", departmentId: null },
        ];
        await expect(
          operation({
            ...admin,
            roleGrants: reverse ? [...roleGrants].reverse() : roleGrants,
          }),
        ).resolves.toBeDefined();
      },
    );
  }
  it("authorizes before validating malformed mutation/filter bodies", async () => {
    const actor = { ...admin, roleGrants: [] };
    await expect(savePrMasterData(actor, null)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(exportAuditEvents(actor, null as never)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      recordReleaseEvidence(actor, null as never, "corr"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expectNoIO();
  });
});

describe("master data validation, isolation and durable audit", () => {
  it.each([
    null,
    [],
    {},
    { ...master, channels: [] },
    { ...master, channels: [" "] },
    { ...master, channels: ["a".repeat(201)] },
  ])("rejects invalid master data without IO: %j", async (input) => {
    await expect(savePrMasterData(admin, input)).rejects.toMatchObject({
      statusCode: 422,
      code: "INVALID_MASTER_DATA",
    });
    expectNoIO();
  });
  it("normalizes supported fields only, pins organization, and records audit/outbox in the transaction", async () => {
    const result = await savePrMasterData(
      admin,
      {
        ...master,
        channels: [" Website ", "Website"],
        organizationId: "org-2",
        secret: "not persisted",
      },
      "corr-master",
    );
    expect(result).toEqual(master);
    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.prisma.prOrganizationSetting.upsert).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: "org-1", key: "pr-master-data" } },
      create: { organizationId: "org-1", key: "pr-master-data", value: master },
      update: { value: master },
    });
    expect(mocks.prisma.prAuditEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorId: "admin-1",
        action: "pr.master_data.updated",
        entityType: "master_data",
        entityId: "setting-1",
        correlationId: "corr-master",
        after: master,
      },
    });
    expect(mocks.prisma.prOutboxEvent.create).toHaveBeenCalledWith({
      data: {
        aggregateType: "master_data",
        aggregateId: "setting-1",
        eventType: "pr.master_data.updated",
        payload: master,
        idempotencyKey: "pr.master_data.updated:setting-1:corr-master",
      },
    });
  });
});

describe("audit export filters and safe projection", () => {
  it.each([
    null,
    [],
    { from: "invalid" },
    { to: "invalid" },
    { from: "2026-02-01", to: "2026-01-01" },
    { from: 123 },
    { entityType: {} },
    { actorId: [] },
  ])("rejects malformed filters before any query: %j", async (filters) => {
    await expect(exportAuditEvents(admin, filters as never)).rejects.toMatchObject({
      statusCode: 422,
    });
    expectNoIO();
  });
  it("keeps inclusive date/actor/entity filters conjunctive with organization and excludes unselected actor fields", async () => {
    const filters = {
      from: "2026-01-01",
      to: "2026-01-31T23:59:59Z",
      actorId: "person-1",
      entityType: "request",
    };
    mocks.prisma.prAuditEvent.findMany.mockResolvedValue([
      {
        id: "audit-1",
        organizationId: "org-1",
        actorId: "person-1",
        actor: {
          displayName: "Person",
          email: "person@example.test",
          entraObjectId: "private",
        },
        action: "request.updated",
        entityType: "request",
        entityId: "request-1",
        correlationId: "original-corr",
        before: null,
        after: { status: "DRAFT" },
        createdAt: signedAt,
        extraPrivate: "private",
      },
    ]);
    const result = await exportAuditEvents(admin, filters, "corr-export");
    expect(mocks.prisma.prAuditEvent.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        entityType: "request",
        actorId: "person-1",
        createdAt: { gte: new Date(filters.from), lte: new Date(filters.to) },
      },
      include: { actor: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    expect(result.events).toEqual([
      {
        id: "audit-1",
        organizationId: "org-1",
        actorId: "person-1",
        actorDisplayName: "Person",
        actorEmail: "person@example.test",
        action: "request.updated",
        entityType: "request",
        entityId: "request-1",
        correlationId: "original-corr",
        before: null,
        after: { status: "DRAFT" },
        createdAt: signedAt.toISOString(),
      },
    ]);
    expect(result.count).toBe(1);
    expect(mocks.prisma.prAuditEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorId: "admin-1",
        action: "audit.exported",
        entityType: "audit_export",
        entityId: "corr-export",
        correlationId: "corr-export",
        after: {
          filters,
          count: 1,
          authorityRoles: [{ role: "RTRDA_ADMIN", departmentId: null }],
        },
      },
    });
  });
  it("records only the effective eligible global ADMIN grant, not unrelated/scoped authority", async () => {
    await exportAuditEvents(
      {
        ...admin,
        roleGrants: [
          { role: "RTRDA_BORD", departmentId: null },
          { role: "RTRDA_ADMIN", departmentId: "dept-a" },
          { role: "RTRDA_ADMIN", departmentId: null },
        ],
      },
      {},
    );
    expect(mocks.prisma.prAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          after: {
            filters: {},
            count: 0,
            authorityRoles: [{ role: "RTRDA_ADMIN", departmentId: null }],
          },
        }),
      }),
    );
  });
  it("does not issue a success audit when the export read fails", async () => {
    mocks.prisma.prAuditEvent.findMany.mockRejectedValue(new Error("read failed"));
    await expect(exportAuditEvents(admin, {})).rejects.toThrow("read failed");
    expect(mocks.prisma.prAuditEvent.create).not.toHaveBeenCalled();
  });
});

describe("release evidence validation and organization boundary", () => {
  it.each([
    {},
    { ...evidence, gateKey: "UNKNOWN" },
    { ...evidence, result: "UNKNOWN" },
    { ...evidence, evidenceReference: " " },
    { ...evidence, evidenceReference: "x".repeat(801) },
    { ...evidence, notes: "x".repeat(2001) },
    { ...evidence, performedAt: "invalid" },
    { ...evidence, performedAt: "9999-01-01" },
  ])("rejects invalid evidence without writes: %j", async (input) => {
    await expect(recordReleaseEvidence(admin, input, "corr")).rejects.toMatchObject({
      statusCode: 422,
      code: "INVALID_RELEASE_EVIDENCE",
    });
    expectNoIO();
  });
  it("appends sanitized evidence with server actor/org/signature and correlation", async () => {
    const saved = await recordReleaseEvidence(
      admin,
      {
        ...evidence,
        evidenceReference: ` ${evidence.evidenceReference} `,
        organizationId: "org-2",
        signedBy: "forged",
        signedAt: "forged",
      },
      "corr-evidence",
    );
    expect(mocks.prisma.prAuditEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorId: "admin-1",
        action: "release.evidence.recorded",
        entityType: "release_evidence",
        entityId: "BACKUP_RESTORE",
        correlationId: "corr-evidence",
        after: evidence,
      },
      select: { id: true, createdAt: true },
    });
    expect(saved).toEqual({
      id: "event-1",
      ...evidence,
      performedAt: new Date(evidence.performedAt),
      signedAt,
      signedBy: "admin-1",
    });
  });
  it("lists only organization evidence with minimal signer select and drops malformed payloads", async () => {
    mocks.prisma.prAuditEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        after: { ...evidence, secret: "private" },
        createdAt: signedAt,
        actor: { displayName: "Signer", email: "signer@example.test" },
      },
      { id: "bad", after: { ...evidence, gateKey: "UNKNOWN" } },
      { id: "null", after: null },
    ]);
    expect(await listReleaseEvidence(admin)).toEqual([
      {
        id: "event-1",
        ...evidence,
        signedAt,
        signer: { displayName: "Signer", email: "signer@example.test" },
      },
    ]);
    expect(mocks.prisma.prAuditEvent.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        entityType: "release_evidence",
        action: "release.evidence.recorded",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        after: true,
        createdAt: true,
        actor: { select: { displayName: true, email: true } },
      },
    });
  });
});

describe("release readiness organization isolation", () => {
  it("does not expose another organization's failed or delivered email counts", async () => {
    const rows = [
      {
        aggregateType: "notification",
        aggregateId: "foreign-user",
        status: "FAILED",
        eventType: "notification.email.queued",
      },
      {
        aggregateType: "notification",
        aggregateId: "foreign-user",
        status: "DELIVERED",
        eventType: "notification.email.queued",
      },
      {
        aggregateType: "notification",
        aggregateId: "admin-1",
        status: "PENDING",
        eventType: "not-an-email",
      },
      {
        aggregateType: "request",
        aggregateId: "admin-1",
        status: "PENDING",
        eventType: "notification.email.queued",
      },
    ];
    mocks.prisma.prOutboxEvent.count.mockImplementation(
      async ({ where }) =>
        rows.filter(
          (row) =>
            row.status === where.status &&
            row.eventType === where.eventType &&
            (!where.aggregateType || row.aggregateType === where.aggregateType) &&
            (!where.aggregateId || where.aggregateId.in.includes(row.aggregateId)),
        ).length,
    );
    const result = await releaseReadinessCheck(admin);
    expect(result.checks.find((check) => check.name === "Outbox events")).toEqual({
      name: "Outbox events",
      passed: true,
      detail: "pending=0, processing=0, failed=0, delivered=0",
    });
    expect(
      result.checks.find((check) => check.name === "External notification delivery")
        ?.passed,
    ).toBe(false);
  });
  it("keeps an empty organization's recipient predicate empty, not global", async () => {
    mocks.prisma.prCenterUser.findMany.mockResolvedValue([]);
    await releaseReadinessCheck(admin);
    for (const [query] of mocks.prisma.prOutboxEvent.count.mock.calls)
      expect(query.where.aggregateId).toEqual({ in: [] });
  });
  it("scopes every data read including recipient-based email outbox counts", async () => {
    const result = await releaseReadinessCheck(admin);
    expect(result.ready).toBe(false);
    expect(mocks.prisma.prAuditEvent.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
    });
    expect(mocks.prisma.prRequest.count.mock.calls).toEqual([
      [{ where: { organizationId: "org-1", status: "WITHDRAWN" } }],
      [{ where: { organizationId: "org-1", status: "CLOSED" } }],
    ]);
    expect(mocks.prisma.prApproval.count).toHaveBeenCalledWith({
      where: { task: { request: { organizationId: "org-1" } } },
    });
    for (const [query] of mocks.prisma.prFileObject.count.mock.calls)
      expect(query.where.organizationId).toBe("org-1");
    for (const [query] of mocks.prisma.prSchedule.count.mock.calls)
      expect(query.where.task.request).toEqual({ organizationId: "org-1" });
    expect(mocks.prisma.prTask.count).toHaveBeenCalledWith({
      where: { request: { organizationId: "org-1" }, status: "PUBLISHED" },
    });
    expect(mocks.prisma.prNotification.count).toHaveBeenCalledWith({
      where: { user: { organizationId: "org-1" } },
    });
    expect(mocks.prisma.prCenterUser.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      select: { id: true },
    });
    for (const status of ["PENDING", "PROCESSING", "FAILED", "DELIVERED"])
      expect(mocks.prisma.prOutboxEvent.count).toHaveBeenCalledWith({
        where: {
          aggregateType: "notification",
          aggregateId: { in: ["admin-1"] },
          eventType: "notification.email.queued",
          status,
        },
      });
    expect(mocks.prisma.prAuditEvent.create).not.toHaveBeenCalled();
    expect(mocks.prisma.prOutboxEvent.create).not.toHaveBeenCalled();
  });
});
