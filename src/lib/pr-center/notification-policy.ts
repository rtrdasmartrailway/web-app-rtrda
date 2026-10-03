import { randomUUID } from "node:crypto";
import type { PrTaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";

// ── Notification categories (encoded in title prefix) ───────────────────
export type NotificationCategory =
  | "DUE"
  | "OVERDUE"
  | "MANDATORY"
  | "CHANGE"
  | "ASSIGNMENT"
  | "STATUS"
  | "COMMENT"
  | "GENERAL";

const CATEGORY_PREFIX: Record<NotificationCategory, string> = {
  DUE: "[DUE]",
  OVERDUE: "[OVERDUE]",
  MANDATORY: "[MANDATORY]",
  CHANGE: "[CHANGE]",
  ASSIGNMENT: "[ASSIGNMENT]",
  STATUS: "[STATUS]",
  COMMENT: "[COMMENT]",
  GENERAL: "[GENERAL]",
};

export function classifyNotification(title: string): NotificationCategory {
  const upper = title.toUpperCase();
  for (const [category, prefix] of Object.entries(CATEGORY_PREFIX)) {
    if (upper.startsWith(prefix)) return category as NotificationCategory;
  }
  // Legacy patterns from existing inline notifications
  if (upper.includes("ASSIGNED")) return "ASSIGNMENT";
  if (upper.includes("APPROVAL") || upper.includes("REVIEW")) return "STATUS";
  if (upper.includes("COMMENT")) return "COMMENT";
  return "GENERAL";
}

export function prefixedTitle(category: NotificationCategory, body: string): string {
  return `${CATEGORY_PREFIX[category]} ${body}`;
}

// ── Policy configuration ────────────────────────────────────────────────

/** Hours before dueAt to fire a due-reminder. Default 48h. */
const DUE_REMINDER_HOURS = 48;

/** Closed/terminal statuses that should not receive reminders. */
const TERMINAL_STATUSES = new Set([
  "PUBLISHED",
  "CLOSED",
  "CANCELLED",
  "REJECTED",
]);

// ── Reminder computation ────────────────────────────────────────────────

export type ReminderCandidate = {
  id: string;
  title: string;
  ownerId: string | null;
  dueAt: Date | null;
  status: string;
  requestId: string;
};

/**
 * Find tasks approaching their dueAt within DUE_REMINDER_HOURS
 * that are not in a terminal status and have an owner.
 */
export async function computeDueReminders(): Promise<ReminderCandidate[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + DUE_REMINDER_HOURS * 60 * 60 * 1000);

  return prisma.prTask.findMany({
    where: {
      dueAt: { gte: now, lte: horizon },
      ownerId: { not: null },
      status: { notIn: [...TERMINAL_STATUSES] as PrTaskStatus[] },
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      dueAt: true,
      status: true,
      requestId: true,
    },
  });
}

/**
 * Find tasks that are past dueAt and not in a terminal status.
 */
export async function computeOverdueReminders(): Promise<ReminderCandidate[]> {
  const now = new Date();

  return prisma.prTask.findMany({
    where: {
      dueAt: { lt: now },
      ownerId: { not: null },
      status: { notIn: [...TERMINAL_STATUSES] as PrTaskStatus[] },
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      dueAt: true,
      status: true,
      requestId: true,
    },
  });
}

/**
 * Find tasks in mandatory-approval statuses that have been waiting
 * longer than 24h without movement.
 */
export async function computeMandatoryReminders(): Promise<ReminderCandidate[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return prisma.prTask.findMany({
    where: {
      status: {
        in: [
          "SOURCE_FACT_CHECK",
          "TECHNICAL_REVIEW",
          "PR_EDITORIAL_REVIEW",
          "MANAGEMENT_APPROVAL",
        ] as PrTaskStatus[],
      },
      ownerId: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      dueAt: true,
      status: true,
      requestId: true,
    },
  });
}

// ── Material-change notifications ───────────────────────────────────────

export type MaterialChangeInput = {
  taskId: string;
  taskTitle: string;
  ownerId: string | null;
  changeDescription: string;
};

/**
 * Create a material-change notification for the task owner.
 */
export async function createMaterialChangeNotification(
  input: MaterialChangeInput,
  _correlationId: string = randomUUID(),
): Promise<void> {
  if (!input.ownerId) return;

  await prisma.prNotification.create({
    data: {
      userId: input.ownerId,
      title: prefixedTitle("CHANGE", input.changeDescription),
      body: input.taskTitle,
      target: "operations",
    },
  });
}

// ── Policy evaluation (main entry point) ────────────────────────────────

export type PolicyEvaluationResult = {
  dueRemindersCreated: number;
  overdueRemindersCreated: number;
  mandatoryRemindersCreated: number;
  totalNotificationsCreated: number;
};

/**
 * Evaluate notification policy: create notifications for due, overdue,
 * and mandatory reminders. Idempotent — skips tasks that already have
 * a recent notification of the same category.
 */
export async function evaluateNotificationPolicy(): Promise<PolicyEvaluationResult> {
  const [dueTasks, overdueTasks, mandatoryTasks] = await Promise.all([
    computeDueReminders(),
    computeOverdueReminders(),
    computeMandatoryReminders(),
  ]);

  // Deduplicate: avoid re-notifying tasks already notified in last 12h
  const recentCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recentNotifications = await prisma.prNotification.findMany({
    where: {
      createdAt: { gte: recentCutoff },
      title: {
        startsWith: "[",
      },
    },
    select: { userId: true, title: true },
  });
  const recentKeys = new Set(
    recentNotifications.map((n) => `${n.userId}:${n.title}`),
  );

  const notifications: Array<{
    userId: string;
    title: string;
    body: string;
    target: string;
  }> = [];

  for (const task of dueTasks) {
    if (!task.ownerId) continue;
    const title = prefixedTitle(
      "DUE",
      `Task due soon: ${task.title.slice(0, 80)}`,
    );
    const key = `${task.ownerId}:${title}`;
    if (recentKeys.has(key)) continue;
    notifications.push({
      userId: task.ownerId,
      title,
      body: `Task "${task.title}" is due ${task.dueAt!.toISOString().slice(0, 10)}. Status: ${task.status}.`,
      target: "operations",
    });
  }

  for (const task of overdueTasks) {
    if (!task.ownerId) continue;
    const title = prefixedTitle(
      "OVERDUE",
      `Task overdue: ${task.title.slice(0, 80)}`,
    );
    const key = `${task.ownerId}:${title}`;
    if (recentKeys.has(key)) continue;
    notifications.push({
      userId: task.ownerId,
      title,
      body: `Task "${task.title}" was due ${task.dueAt!.toISOString().slice(0, 10)} and is now overdue. Status: ${task.status}.`,
      target: "operations",
    });
  }

  for (const task of mandatoryTasks) {
    if (!task.ownerId) continue;
    const title = prefixedTitle(
      "MANDATORY",
      `Pending approval: ${task.title.slice(0, 80)}`,
    );
    const key = `${task.ownerId}:${title}`;
    if (recentKeys.has(key)) continue;
    notifications.push({
      userId: task.ownerId,
      title,
      body: `Task "${task.title}" has been awaiting action for over 24 hours. Status: ${task.status}.`,
      target: "approvals",
    });
  }

  // Bulk-create all notifications
  if (notifications.length > 0) {
    await prisma.prNotification.createMany({ data: notifications });
  }

  return {
    dueRemindersCreated: dueTasks.length,
    overdueRemindersCreated: overdueTasks.length,
    mandatoryRemindersCreated: mandatoryTasks.length,
    totalNotificationsCreated: notifications.length,
  };
}