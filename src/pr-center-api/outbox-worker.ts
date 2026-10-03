import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";

const EMAIL_EVENT_TYPE = "notification.email.queued";
const POLL_INTERVAL_MS = 2_000;
const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 60 * 60_000;
const HEALTH_PORT = Number(process.env.PR_CENTER_OUTBOX_WORKER_PORT || "3101");

export type EmailOutboxPayload = {
  to: string;
  subject: string;
  body: string;
};

export function parseEmailOutboxPayload(value: unknown): EmailOutboxPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  if (
    !to ||
    to.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
    typeof payload.subject !== "string" ||
    !payload.subject.trim() ||
    payload.subject.length > 250 ||
    /[\r\n]/.test(payload.subject) ||
    typeof payload.body !== "string" ||
    !payload.body.trim() ||
    payload.body.length > 20_000
  )
    return null;
  return {
    to,
    subject: payload.subject.trim(),
    body: payload.body,
  };
}

export function isEmailRecipientAllowed(to: string, allowlist: string): boolean {
  const normalized = to.trim().toLowerCase();
  return allowlist
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

export function retryDelayMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(20, Math.trunc(attempt) - 1));
  return Math.min(BASE_RETRY_MS * 2 ** exponent, MAX_RETRY_MS);
}

function smtpConfig() {
  const host = process.env.PR_CENTER_SMTP_HOST?.trim();
  const port = Number(process.env.PR_CENTER_SMTP_PORT || "587");
  const user = process.env.PR_CENTER_SMTP_USER?.trim();
  const from = process.env.PR_CENTER_SMTP_FROM?.trim();
  const passwordFile = process.env.PR_CENTER_SMTP_PASSWORD_FILE?.trim();
  const allowlist = process.env.PR_CENTER_EMAIL_ONLY_ALLOWLIST || "";
  const secure = process.env.PR_CENTER_SMTP_SECURE === "true";
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !from ||
    !passwordFile ||
    !allowlist.trim()
  )
    return null;
  return { host, port, user, from, passwordFile, allowlist, secure };
}

export function createWorkerHealthResponse(ready: boolean) {
  return { service: "pr-center-email-outbox", ready };
}

async function start() {
  let transporter: Transporter | null = null;
  let smtpReady = false;
  let lastVerifyAt = 0;
  let polling = false;
  let lastConfigLogAt = 0;

  const server = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({ ...createWorkerHealthResponse(smtpReady), live: true }),
      );
      return;
    }
    if (request.url === "/readyz") {
      response.writeHead(smtpReady ? 200 : 503, { "Content-Type": "application/json" });
      response.end(JSON.stringify(createWorkerHealthResponse(smtpReady)));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  server.listen(HEALTH_PORT, "0.0.0.0");

  const refreshTransport = async () => {
    const now = Date.now();
    if (now - lastVerifyAt < 60_000) return;
    lastVerifyAt = now;
    const config = smtpConfig();
    if (!config) {
      smtpReady = false;
      transporter?.close();
      transporter = null;
      if (now - lastConfigLogAt > 300_000) {
        console.warn("Email outbox is idle: SMTP configuration is incomplete.");
        lastConfigLogAt = now;
      }
      return;
    }
    try {
      const password = (await readFile(config.passwordFile, "utf8")).trim();
      if (!password) throw new Error("SMTP password file is empty");
      const nextTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: password },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      });
      await nextTransporter.verify();
      transporter?.close();
      transporter = nextTransporter;
      smtpReady = true;
      console.info("Email outbox SMTP transport is ready.");
    } catch {
      smtpReady = false;
      transporter?.close();
      transporter = null;
      console.warn(
        "Email outbox SMTP verification failed; queued messages will remain pending.",
      );
    }
  };

  const releaseExpiredLeases = async (now: Date) => {
    const expiredBefore = new Date(now.getTime() - LEASE_MS);
    const expired = await prisma.prOutboxEvent.findMany({
      where: {
        eventType: EMAIL_EVENT_TYPE,
        status: "PROCESSING",
        lockedAt: { lte: expiredBefore },
      },
      select: { id: true, attempts: true },
      take: 100,
    });
    for (const event of expired) {
      await prisma.prOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: "PROCESSING",
          lockedAt: { lte: expiredBefore },
        },
        data: {
          status: event.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          lockedAt: null,
          availableAt: now,
          lastError: "Processing lease expired; event requeued",
          ...(event.attempts >= MAX_ATTEMPTS ? { processedAt: now } : {}),
        },
      });
    }
  };

  const claimNext = async (now: Date) => {
    const event = await prisma.prOutboxEvent.findFirst({
      where: {
        eventType: EMAIL_EVENT_TYPE,
        status: "PENDING",
        availableAt: { lte: now },
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    });
    if (!event) return null;
    const claimed = await prisma.prOutboxEvent.updateMany({
      where: { id: event.id, status: "PENDING", availableAt: { lte: now } },
      data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
    });
    return claimed.count === 1
      ? { ...event, attempts: event.attempts + 1, lockedAt: now }
      : null;
  };

  const updateEvent = async (
    id: string,
    lockedAt: Date,
    attempts: number,
    status: "DELIVERED" | "PENDING" | "FAILED",
    error: string | null,
  ) => {
    const now = new Date();
    await prisma.prOutboxEvent.updateMany({
      where: { id, status: "PROCESSING", lockedAt },
      data: {
        status,
        lockedAt: null,
        lastError: error,
        availableAt:
          status === "PENDING" ? new Date(now.getTime() + retryDelayMs(attempts)) : now,
        processedAt: status === "PENDING" ? null : now,
      },
    });
  };

  const deliver = async (event: {
    id: string;
    lockedAt: Date;
    attempts: number;
    payload: Prisma.JsonValue;
  }) => {
    const config = smtpConfig();
    const message = parseEmailOutboxPayload(event.payload);
    if (!config || !transporter || !message) {
      await updateEvent(
        event.id,
        event.lockedAt,
        event.attempts,
        "FAILED",
        "Invalid email payload or SMTP configuration",
      );
      return;
    }
    if (!isEmailRecipientAllowed(message.to, config.allowlist)) {
      await updateEvent(
        event.id,
        event.lockedAt,
        event.attempts,
        "FAILED",
        "Recipient is not on the configured allowlist",
      );
      return;
    }
    try {
      await transporter.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
        messageId: `<pr-center-${event.id}@rtrda.or.th>`,
      });
      await updateEvent(event.id, event.lockedAt, event.attempts, "DELIVERED", null);
    } catch (error) {
      const responseCode =
        typeof error === "object" && error !== null && "responseCode" in error
          ? Number((error as { responseCode?: unknown }).responseCode)
          : 0;
      const transient = responseCode === 0 || (responseCode >= 400 && responseCode < 500);
      const status = transient && event.attempts < MAX_ATTEMPTS ? "PENDING" : "FAILED";
      await updateEvent(
        event.id,
        event.lockedAt,
        event.attempts,
        status,
        responseCode ? `SMTP response ${responseCode}` : "SMTP transport error",
      );
    }
  };

  const tick = async () => {
    if (polling) return;
    polling = true;
    try {
      await refreshTransport();
      if (!smtpReady || !transporter) return;
      const now = new Date();
      await releaseExpiredLeases(now);
      const event = await claimNext(now);
      if (event) await deliver(event);
    } catch {
      console.error("Email outbox poll failed; pending events were not acknowledged.");
    } finally {
      polling = false;
    }
  };

  const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  void tick();
  const shutdown = async () => {
    clearInterval(timer);
    transporter?.close();
    server.close();
    await prisma.$disconnect();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void start();
}
