import { randomInt, randomUUID } from "node:crypto";
import {
  isProtectedDocumentId,
  type ProtectedDocumentId,
} from "@/lib/documents/protected-documents";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ISSUES_PER_WINDOW = 10;
const MAX_ATTEMPTS = 5;

export type ProtectedDocumentAction = "download" | "preview";

interface Challenge {
  answer: number;
  attempts: number;
  documentId: ProtectedDocumentId;
  expiresAt: number;
  ip: string;
  action: ProtectedDocumentAction;
}

interface RateLimit {
  count: number;
  resetAt: number;
}

const challenges = new Map<string, Challenge>();
const rateLimits = new Map<string, RateLimit>();

export type CaptchaVerification = "invalid" | "expired" | "success" | "wrong";

function cleanup(now: number) {
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= now) challenges.delete(id);
  }
  for (const [ip, limit] of rateLimits) {
    if (limit.resetAt <= now) rateLimits.delete(ip);
  }
}

export function isProtectedDocumentAction(
  value: string,
): value is ProtectedDocumentAction {
  return value === "download" || value === "preview";
}

export function issueDownloadCaptcha(
  documentId: string,
  ip: string,
  action: ProtectedDocumentAction = "download",
  now = Date.now(),
) {
  cleanup(now);
  if (!isProtectedDocumentId(documentId)) return null;

  const current = rateLimits.get(ip);
  if (current && current.count >= MAX_ISSUES_PER_WINDOW) return null;
  rateLimits.set(ip, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt ?? now + RATE_WINDOW_MS,
  });

  const left = randomInt(2, 10);
  const right = randomInt(2, 10);
  const id = randomUUID();
  challenges.set(id, {
    answer: left + right,
    attempts: 0,
    documentId,
    expiresAt: now + CHALLENGE_TTL_MS,
    ip,
    action,
  });

  return { id, question: `${left} + ${right} = ?` };
}

export function verifyDownloadCaptcha(
  id: string,
  answer: unknown,
  documentId: string,
  ip: string,
  action: ProtectedDocumentAction = "download",
  now = Date.now(),
): CaptchaVerification {
  const challenge = challenges.get(id);
  if (!challenge || !isProtectedDocumentId(documentId)) return "invalid";
  if (challenge.expiresAt <= now) {
    challenges.delete(id);
    return "expired";
  }
  cleanup(now);
  if (
    challenge.ip !== ip ||
    challenge.documentId !== documentId ||
    challenge.action !== action
  )
    return "invalid";

  const numericAnswer = typeof answer === "number" ? answer : Number(answer);
  if (!Number.isInteger(numericAnswer) || numericAnswer !== challenge.answer) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_ATTEMPTS) challenges.delete(id);
    return "wrong";
  }

  challenges.delete(id);
  return "success";
}

export function requestIp(headers: Headers): string {
  const value =
    headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for") ?? "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}
