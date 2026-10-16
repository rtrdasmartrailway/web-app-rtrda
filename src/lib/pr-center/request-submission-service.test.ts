import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    prRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    prOrganizationSetting: { findUnique: vi.fn() },
    prRequestRevision: { create: vi.fn() },
    prRequestSource: { deleteMany: vi.fn(), createMany: vi.fn() },
    prTask: { create: vi.fn(), updateMany: vi.fn() },
    prUserRole: { findMany: vi.fn() },
    prStatusHistory: { create: vi.fn() },
    prNotification: { createMany: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db/client", () => ({ prisma }));
import { createRequest, updateRequestDraft, transitionRequest } from "./service";

const actor = {
  id: "owner",
  organizationId: "org",
  departmentId: "dept",
  role: "RTRDA_ALL_USER" as const,
};
const details = {
  projectOwner: "Owner",
  assigner: "Director",
  confirmed: true,
  whyNow: "Results ready",
  contentTypes: ["Website News"],
  priorityReason: "",
  projectDetails: "",
};
const record = () => ({
  id: "request",
  organizationId: "org",
  departmentId: "dept",
  requesterId: "owner",
  requestNumber: "PR-1",
  status: "DRAFT",
  version: 2,
  type: "PR",
  title: "Research update",
  requestedFor: new Date("2026-11-20"),
  sources: [{ url: "https://example.org/brief" }],
  tasks: [],
  revisions: [
    {
      revisionNumber: 2,
      title: "Research update",
      objective: "Inform passengers",
      audience: "Passengers",
      offsiteDetails: { ...details },
    },
  ],
});
const draftInput = { type: "PR" as const, title: "Legacy draft", sourceUrls: [] };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.prRequest.findFirst.mockResolvedValue(record());
  prisma.prRequest.updateMany.mockResolvedValue({ count: 1 });
  prisma.prRequest.create.mockResolvedValue(record());
  prisma.prRequest.findUniqueOrThrow.mockResolvedValue({ ...record(), version: 3 });
  prisma.prUserRole.findMany.mockResolvedValue([{ userId: "reviewer" }]);
  prisma.prOrganizationSetting.findUnique.mockResolvedValue(null);
});

describe("amendment authorization boundary", () => {
  it("rejects a non-owner even when a scoped read returned the record", async () => {
    await expect(
      updateRequestDraft({ ...actor, id: "other" }, "request", 2, draftInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(["APPROVED", "CLOSED", "CANCELLED"])(
    "rejects editing at %s",
    async (status) => {
      prisma.prRequest.findFirst.mockResolvedValue({ ...record(), status });
      await expect(
        updateRequestDraft(actor, "request", 2, draftInput),
      ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects stale amendments and tasks already in progress", async () => {
    await expect(
      updateRequestDraft(actor, "request", 1, draftInput),
    ).rejects.toMatchObject({ code: "STALE_UPDATE" });
    prisma.prRequest.findFirst.mockResolvedValue({
      ...record(),
      tasks: [{ id: "task", status: "IN_PRODUCTION" }],
    });
    await expect(
      updateRequestDraft(actor, "request", 2, draftInput),
    ).rejects.toMatchObject({ code: "REQUEST_WORK_ALREADY_STARTED" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("does not write a revision after a conditional-update conflict", async () => {
    prisma.prRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateRequestDraft(actor, "request", 2, draftInput),
    ).rejects.toMatchObject({ code: "STALE_UPDATE" });
    expect(prisma.prRequestRevision.create).not.toHaveBeenCalled();
  });
});

describe("submission service boundary", () => {
  it("keeps legacy incomplete drafts creatable and amendable", async () => {
    await expect(createRequest(actor, draftInput)).resolves.toHaveProperty(
      "id",
      "request",
    );
    await expect(
      updateRequestDraft(actor, "request", 2, draftInput),
    ).resolves.toHaveProperty("id", "request");
  });

  it.each([
    { requestedFor: null },
    { sources: [] },
    { title: " " },
    { revisions: [] },
    { revisions: [{ ...record().revisions[0], objective: null }] },
    { revisions: [{ ...record().revisions[0], offsiteDetails: null }] },
    {
      revisions: [
        { ...record().revisions[0], offsiteDetails: { ...details, confirmed: false } },
      ],
    },
    {
      revisions: [
        {
          ...record().revisions[0],
          offsiteDetails: { ...details, contentTypes: ["Retired type"] },
        },
      ],
    },
  ])("rejects incomplete canonical data before any write: %j", async (change) => {
    prisma.prRequest.findFirst.mockResolvedValue({ ...record(), ...change });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.prRequest.updateMany).not.toHaveBeenCalled();
    expect(prisma.prTask.create).not.toHaveBeenCalled();
    expect(prisma.prStatusHistory.create).not.toHaveBeenCalled();
    expect(prisma.prNotification.createMany).not.toHaveBeenCalled();
    expect(prisma.prAuditEvent.create).not.toHaveBeenCalled();
    expect(prisma.prOutboxEvent.create).not.toHaveBeenCalled();
  });

  it("submits a complete PR from its latest persisted revision and creates selected tasks", async () => {
    await transitionRequest(actor, "request", 2, "SUBMITTED");
    expect(prisma.prRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "request", organizationId: "org", OR: [{ requesterId: "owner" }] },
        include: expect.objectContaining({
          revisions: { orderBy: { revisionNumber: "desc" } },
        }),
      }),
    );
    expect(prisma.prRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "request", version: 2 }),
        data: { status: "SUBMITTED", version: { increment: 1 } },
      }),
    );
    expect(prisma.prTask.create).toHaveBeenCalledExactlyOnceWith({
      data: {
        requestId: "request",
        contentType: "Website News",
        title: "Website News: Research update",
        dueAt: record().requestedFor,
      },
    });
    expect(prisma.prAuditEvent.create).toHaveBeenCalled();
    expect(prisma.prOutboxEvent.create).toHaveBeenCalled();
  });

  it("revalidates organization-specific master content types at submission", async () => {
    prisma.prOrganizationSetting.findUnique.mockResolvedValue({
      value: { contentTypes: ["Custom type"] },
    });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({ statusCode: 422 });
    prisma.prRequest.findFirst.mockResolvedValue({
      ...record(),
      revisions: [
        {
          ...record().revisions[0],
          offsiteDetails: { ...details, contentTypes: ["Custom type"] },
        },
      ],
    });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).resolves.toHaveProperty("id", "request");
  });

  it("accepts complete off-site requests without PR-only fields", async () => {
    prisma.prRequest.findFirst.mockResolvedValue({
      ...record(),
      type: "OFFSITE",
      revisions: [
        {
          revisionNumber: 2,
          objective: null,
          audience: null,
          offsiteDetails: {
            projectOwner: "Owner",
            assigner: "Director",
            confirmed: true,
            startTime: "09:00",
            endTime: "10:00",
            travel: "Agency vehicle",
          },
        },
      ],
    });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).resolves.toHaveProperty("id", "request");
    expect(prisma.prTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contentType: "Off-site Support" }),
      }),
    );
  });

  it.each([
    { startTime: "24:00" },
    { endTime: "" },
    { endTime: "08:00" },
    { travel: " " },
  ])("rejects incomplete canonical off-site data before writes: %j", async (change) => {
    prisma.prRequest.findFirst.mockResolvedValue({
      ...record(),
      type: "OFFSITE",
      revisions: [
        {
          revisionNumber: 2,
          offsiteDetails: {
            ...details,
            startTime: "09:00",
            endTime: "10:00",
            travel: "Agency vehicle",
            ...change,
          },
        },
      ],
    });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "INVALID_OFFSITE_DETAILS",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not fall back to an older complete revision", async () => {
    prisma.prRequest.findFirst.mockResolvedValue({
      ...record(),
      revisions: [
        { ...record().revisions[0], revisionNumber: 3, objective: "" },
        record().revisions[0],
      ],
    });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("preserves reviewer availability and optimistic concurrency gates for complete submissions", async () => {
    prisma.prUserRole.findMany.mockResolvedValue([]);
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({
      code: "NO_INTAKE_REVIEWER",
      statusCode: 409,
    });
    expect(prisma.prNotification.createMany).not.toHaveBeenCalled();
    prisma.prRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({
      code: "STALE_UPDATE",
      statusCode: 409,
    });
  });

  it.each([
    { objective: "x".repeat(5001) },
    { audience: "x".repeat(5001) },
    { priorityReason: "x".repeat(1001) },
    { requestedFor: new Date("invalid") },
    { sourceUrls: Array(101).fill("https://example.org") },
  ])(
    "applies the same supplied field bounds to create and amendment: %j",
    async (change) => {
      await expect(
        createRequest(actor, { ...draftInput, ...change }),
      ).rejects.toMatchObject({ statusCode: 422 });
      await expect(
        updateRequestDraft(actor, "request", 2, { ...draftInput, ...change }),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it("does not validate completeness when withdrawing an incomplete legacy draft", async () => {
    prisma.prRequest.findFirst.mockResolvedValue({
      ...record(),
      requestedFor: null,
      revisions: [],
      sources: [],
    });
    await expect(
      transitionRequest(actor, "request", 2, "WITHDRAWN"),
    ).resolves.toHaveProperty("id", "request");
  });

  it.each([
    [{ ...actor, id: "other", role: "RTRDA_PR" as const }, 2, "FORBIDDEN"],
    [actor, 1, "STALE_UPDATE"],
  ])(
    "preserves ownership and version guards before completeness",
    async (who, version, code) => {
      prisma.prRequest.findFirst.mockResolvedValue({ ...record(), revisions: [] });
      await expect(
        transitionRequest(who, "request", version, "SUBMITTED"),
      ).rejects.toMatchObject({ code });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it("preserves scoped not-found behavior", async () => {
    prisma.prRequest.findFirst.mockResolvedValue(null);
    await expect(
      transitionRequest(actor, "request", 2, "SUBMITTED"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns amendment revisions newest first, preserving revision history", async () => {
    await updateRequestDraft(actor, "request", 2, draftInput);
    expect(prisma.prRequest.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "request" },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" } },
        sources: true,
        tasks: true,
      },
    });
    expect(prisma.prRequestRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 3 }),
      }),
    );
  });
});
