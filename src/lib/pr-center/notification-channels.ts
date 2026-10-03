import { prisma } from "@/lib/db/client";

// ── Channel interface ───────────────────────────────────────────────────

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  target: string;
  /** E.g. email address, LINE user ID, etc. */
  recipientAddress?: string;
}

export interface NotificationChannel {
  readonly name: string;
  readonly enabled: boolean;
  send(payload: NotificationPayload): Promise<DeliveryResult>;
}

export type DeliveryResult = {
  channel: string;
  status: "queued" | "delivered" | "skipped" | "failed";
  outboxEventId?: string;
  error?: string;
};

// ── Outbox channel (always-on, writes to PrOutboxEvent for audit) ───────

export class OutboxNotificationChannel implements NotificationChannel {
  readonly name = "outbox";
  readonly enabled = true;

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    const idempotencyKey = `notif-outbox:${payload.userId}:${payload.title}:${Date.now()}`;
    try {
      const event = await prisma.prOutboxEvent.create({
        data: {
          aggregateType: "notification",
          aggregateId: payload.userId,
          eventType: "notification.external.queued",
          payload: {
            channel: this.name,
            title: payload.title,
            body: payload.body,
            target: payload.target,
            recipientAddress: payload.recipientAddress ?? null,
          },
          idempotencyKey,
        },
      });
      return {
        channel: this.name,
        status: "queued",
        outboxEventId: event.id,
      };
    } catch (error) {
      return {
        channel: this.name,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ── Email channel (stub — logs intent, does not send real email) ────────

export class EmailNotificationChannel implements NotificationChannel {
  readonly name = "email";
  readonly enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    if (!this.enabled) {
      return { channel: this.name, status: "skipped" };
    }

    // Stub: in production, integrate with SMTP or transactional email service.
    // For now, record the intent in the outbox for audit evidence.
    const idempotencyKey = `notif-email:${payload.userId}:${payload.title}:${Date.now()}`;
    try {
      const event = await prisma.prOutboxEvent.create({
        data: {
          aggregateType: "notification",
          aggregateId: payload.userId,
          eventType: "notification.email.queued",
          payload: {
            channel: this.name,
            to: payload.recipientAddress ?? "unknown",
            subject: payload.title,
            body: payload.body,
          },
          idempotencyKey,
        },
      });
      return {
        channel: this.name,
        status: "queued",
        outboxEventId: event.id,
      };
    } catch (error) {
      return {
        channel: this.name,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ── LINE channel (stub — disabled by default) ──────────────────────────

export class LineNotificationChannel implements NotificationChannel {
  readonly name = "line";
  readonly enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    if (!this.enabled) {
      return { channel: this.name, status: "skipped" };
    }

    // Stub: in production, call LINE Messaging API push message endpoint.
    // For now, record the intent in the outbox for audit evidence.
    const idempotencyKey = `notif-line:${payload.userId}:${payload.title}:${Date.now()}`;
    try {
      const event = await prisma.prOutboxEvent.create({
        data: {
          aggregateType: "notification",
          aggregateId: payload.userId,
          eventType: "notification.line.queued",
          payload: {
            channel: this.name,
            lineUserId: payload.recipientAddress ?? "unknown",
            message: `${payload.title}\n${payload.body}`,
          },
          idempotencyKey,
        },
      });
      return {
        channel: this.name,
        status: "queued",
        outboxEventId: event.id,
      };
    } catch (error) {
      return {
        channel: this.name,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ── Channel registry ───────────────────────────────────────────────────

let defaultChannels: NotificationChannel[] = [
  new OutboxNotificationChannel(),
  new EmailNotificationChannel(false), // disabled by default
  new LineNotificationChannel(false), // disabled by default
];

export function getNotificationChannels(): NotificationChannel[] {
  return defaultChannels;
}

export function setNotificationChannels(channels: NotificationChannel[]): void {
  defaultChannels = channels;
}

/**
 * Dispatch a notification through all enabled external channels.
 * Returns results from each channel.
 */
export async function dispatchNotification(
  payload: NotificationPayload,
): Promise<DeliveryResult[]> {
  const channels = getNotificationChannels();
  const results: DeliveryResult[] = [];

  for (const channel of channels) {
    if (!channel.enabled) {
      results.push({ channel: channel.name, status: "skipped" });
      continue;
    }
    results.push(await channel.send(payload));
  }

  return results;
}
