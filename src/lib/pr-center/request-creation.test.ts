import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => {
  const prisma = {
    prRequest: { create: vi.fn() },
    prUserRole: { findMany: vi.fn() },
    prNotification: { createMany: vi.fn() },
    prAuditEvent: { create: vi.fn() },
    prOutboxEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  return { prisma };
});

vi.mock("@/lib/db/client", () => ({ prisma }));

import { createRequest } from "./service";

const requester = {
  id: "requester-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "REQUESTER" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.prUserRole.findMany.mockResolvedValue([]);
  prisma.prNotification.createMany.mockResolvedValue({ count: 1 });
  prisma.prAuditEvent.create.mockResolvedValue({});
  prisma.prOutboxEvent.create.mockResolvedValue({});
  prisma.prRequest.create.mockResolvedValue({
    id: "request-1",
    requestNumber: "OS-2026-0001",
    version: 1,
  });
});

describe("off-site request creation", () => {
  it("rejects incomplete off-site details before writing a request", async () => {
    await expect(
      createRequest(requester, {
        type: "OFFSITE",
        title: "Rail site visit",
        requestedFor: new Date("2026-10-12T00:00:00.000Z"),
        sourceUrls: ["https://example.org/brief"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_OFFSITE_DETAILS", statusCode: 422 });
    expect(prisma.prRequest.create).not.toHaveBeenCalled();
  });

  it("persists the requested start time and travel arrangement", async () => {
    await createRequest(requester, {
      type: "OFFSITE",
      title: "Rail site visit",
      requestedFor: new Date("2026-10-12T00:00:00.000Z"),
      sourceUrls: ["https://example.org/brief"],
      offsiteDetails: {
        startTime: "09:30",
        travel: "RTRDA transport confirmed",
      },
    });

    expect(prisma.prRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revisions: {
            create: expect.objectContaining({
              offsiteDetails: {
                startTime: "09:30",
                travel: "RTRDA transport confirmed",
              },
            }),
          },
        }),
      }),
    );
  });

  it("rejects an off-site end time before its start time", async () => {
    await expect(
      createRequest(requester, {
        type: "OFFSITE",
        title: "Rail site visit",
        sourceUrls: ["https://example.org/brief"],
        offsiteDetails: {
          startTime: "11:00",
          endTime: "10:30",
          travel: "RTRDA transport confirmed",
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_OFFSITE_DETAILS", statusCode: 422 });
    expect(prisma.prRequest.create).not.toHaveBeenCalled();
  });
});

describe("complete PR request details", () => {
  it("stores request details and creates one content task per selected type", async () => {
    await createRequest(requester, {
      type: "PR",
      title: "Rail research update",
      sourceUrls: ["https://example.org/brief"],
      priority: "HIGH",
      priorityReason: "Announcement date is near",
      requestDetails: {
        projectOwner: "Project Lead",
        assigner: "Communications Coordinator",
        whyNow: "The research results are ready to announce.",
        contentTypes: ["Website News", "Facebook Post"],
        priorityReason: "Announcement date is near",
        projectDetails: "",
        confirmed: true,
      },
    });

    expect(prisma.prRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: "HIGH",
          priorityReason: "Announcement date is near",
          revisions: {
            create: expect.objectContaining({
              offsiteDetails: expect.objectContaining({
                projectOwner: "Project Lead",
                assigner: "Communications Coordinator",
                whyNow: "The research results are ready to announce.",
                contentTypes: ["Website News", "Facebook Post"],
                confirmed: true,
              }),
            }),
          },
          tasks: {
            create: [
              expect.objectContaining({ contentType: "Website News" }),
              expect.objectContaining({ contentType: "Facebook Post" }),
            ],
          },
        }),
      }),
    );
  });

  it("rejects PR details without source confirmation", async () => {
    await expect(
      createRequest(requester, {
        type: "PR",
        title: "Rail research update",
        sourceUrls: ["https://example.org/brief"],
        requestDetails: {
          projectOwner: "Project Lead",
          assigner: "Communications Coordinator",
          whyNow: "Announcement date is near.",
          contentTypes: ["Website News"],
          priorityReason: "",
          projectDetails: "",
          confirmed: false,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST_DETAILS", statusCode: 422 });
    expect(prisma.prRequest.create).not.toHaveBeenCalled();
  });
});
