import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createOutboxEvent } = vi.hoisted(() => ({
  createOutboxEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { prOutboxEvent: { create: createOutboxEvent } },
}));

import {
  OutboxNotificationChannel,
  EmailNotificationChannel,
  LineNotificationChannel,
  type NotificationPayload,
} from "./notification-channels";

const mockPayload: NotificationPayload = {
  userId: "user-1",
  title: "[DUE] Task due soon",
  body: "Task 'My Task' is due 2026-10-05.",
  target: "operations",
  recipientAddress: "user@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  createOutboxEvent.mockResolvedValue({ id: "outbox-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OutboxNotificationChannel", () => {
  it("is always enabled", () => {
    const channel = new OutboxNotificationChannel();
    expect(channel.enabled).toBe(true);
    expect(channel.name).toBe("outbox");
  });

  it("reports queued rather than delivered until a worker completes delivery", async () => {
    const result = await new OutboxNotificationChannel().send(mockPayload);
    expect(result).toEqual({
      channel: "outbox",
      status: "queued",
      outboxEventId: "outbox-1",
    });
    expect(createOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "notification.external.queued" }),
      }),
    );
  });
});

describe("EmailNotificationChannel", () => {
  it("is disabled by default", () => {
    const channel = new EmailNotificationChannel();
    expect(channel.enabled).toBe(false);
  });

  it("returns skipped when disabled", async () => {
    const channel = new EmailNotificationChannel(false);
    const result = await channel.send(mockPayload);
    expect(result.status).toBe("skipped");
    expect(result.channel).toBe("email");
  });

  it("queues email only when the recipient is on the explicit allowlist", async () => {
    vi.stubEnv("PR_CENTER_EMAIL_ONLY_ALLOWLIST", "user@example.com,other@example.com");
    const result = await new EmailNotificationChannel(true).send(mockPayload);
    expect(result.status).toBe("queued");
    expect(createOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "notification.email.queued",
          payload: expect.objectContaining({ to: "user@example.com" }),
        }),
      }),
    );
  });

  it("does not queue email when the recipient is not allowlisted", async () => {
    vi.stubEnv("PR_CENTER_EMAIL_ONLY_ALLOWLIST", "other@example.com");
    const result = await new EmailNotificationChannel(true).send(mockPayload);
    expect(result.status).toBe("skipped");
    expect(createOutboxEvent).not.toHaveBeenCalled();
  });

  it("can be enabled", () => {
    const channel = new EmailNotificationChannel(true);
    expect(channel.enabled).toBe(true);
  });
});

describe("LineNotificationChannel", () => {
  it("is disabled by default", () => {
    const channel = new LineNotificationChannel();
    expect(channel.enabled).toBe(false);
  });

  it("returns skipped when disabled", async () => {
    const channel = new LineNotificationChannel(false);
    const result = await channel.send(mockPayload);
    expect(result.status).toBe("skipped");
    expect(result.channel).toBe("line");
  });

  it("can be enabled", () => {
    const channel = new LineNotificationChannel(true);
    expect(channel.enabled).toBe(true);
  });
});
